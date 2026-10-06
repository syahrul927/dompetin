// One-off prompt validation against real Groq API (allowed by user).
// Uses the exact prompt from the plan + the user's two OCR samples.
// Run with env loaded: set -a; source .env; set +a; node scripts/test-shortcut-prompt.mjs
import Groq from "groq-sdk";

const wallets = [
  { id: "w-blu", name: "blu by BCA Digital", type: "bank" },
  { id: "w-mandiri", name: "Livin by Mandiri", type: "bank" },
  { id: "w-gopay", name: "GoPay", type: "ewallet" },
];

const categories = [
  { id: "default:makanan-minuman", name: "Makanan & Minuman" },
  { id: "default:transportasi", name: "Transportasi" },
  { id: "default:belanja", name: "Belanja" },
  { id: "default:tagihan-utilitas", name: "Tagihan & Utilitas" },
  { id: "default:hiburan", name: "Hiburan" },
  { id: "default:kesehatan", name: "Kesehatan" },
  { id: "default:pendidikan", name: "Pendidikan" },
  { id: "default:rumah-tangga", name: "Rumah Tangga" },
  { id: "default:lainnya-expense", name: "Lainnya" },
];

function buildShortcutPrompt(wallets, categories) {
  const walletList = wallets
    .map((w) => `- id: "${w.id}", name: "${w.name}", type: ${w.type}`)
    .join("\n");
  const categoryList = categories
    .map((c) => `- id: "${c.id}", name: "${c.name}"`)
    .join("\n");
  const lainnya =
    categories.find((c) => c.id === "default:lainnya-expense")?.id ??
    categories[0]?.id ??
    "";

  return `You are a transaction parser for an Indonesian personal finance app.
The user message is RAW OCR TEXT captured from a screenshot of an Indonesian bank or e-wallet app (blu BCA, Livin' by Mandiri, BCA, BRI, BNI, GoPay, OVO, DANA, ShopeePay, etc).

OCR text is noisy. IGNORE non-transaction noise: status bars ("18.31", ", 4G"), ad banners, promo text, UI buttons ("Beli sekarang", "Bagikan Resi", "Bayar Sekarang", "Lihat Resi"), icons, and layout fragments. Extract exactly ONE transaction: the money movement that happened.

Return strict JSON matching this exact schema:
{
  "name": string,          // merchant, recipient, or description (e.g. "RUNPOD.IO", "MOCHAMAD SOLEH")
  "amount": number,        // whole-number IDR, no decimals
  "date": "YYYY-MM-DD",
  "walletId": string,      // MUST be an id from the wallet list below
  "categoryId": string,    // MUST be an id from the category list below
  "notes": string          // reference numbers, recipient bank/account details, transaction type; "" if none
}

CRITICAL - Indonesian number format:
- Dots (.) are THOUSAND separators, not decimal points. "362.304" = 362304. "1.500.000" = 1500000.
- OCR often mangles decimals: "Rp 362.304:00" or "Rp 362.304,00" both mean 362304.
- Convert spoken/abbreviated forms too: "50rb" = 50000.

Currency:
- If a USD nominal is shown alongside an IDR total (e.g. "Nominal dalam USD $20,00" plus "Total Bayar Rp 362.304"), ALWAYS use the IDR total as the amount.

Date:
- Parse from formats like "20 Sep 2026 | 08:32:24 WIB" or "31 Agu 2026". Indonesian months: Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des.
- If no date is visible, use "${new Date().toISOString().slice(0, 10)}".

walletId - you MUST pick the closest match (never null). Match the issuing bank/e-wallet shown in the text ("From Blu BCA Digital", "Mandiri") against the wallet names:
${walletList}

categoryId - you MUST pick the best-fit category (never null). If nothing fits well, use "${lainnya}":
${categoryList}

This endpoint is used for EXPENSES only. Interpret the transaction as money going out.
If the text contains no recognizable transaction at all, return:
{ "name": null, "amount": null, "date": null, "walletId": null, "categoryId": null, "notes": null }`;
}

const SAMPLE_BLU = `From Blu BCA Digital
18.31
, 4G
Belanja Pakai Garuda x bluDebit
Card, Dapatkan GarudaMiles!
Klik di sini untuk request kartunya
X
Transaksi Berhasil
20 Sep 2026 | 08:32:24 WIB
Total Bayar
Rp 362.304:00
RUNPOD.IO
oluvirtual Card - ..
... 7530
Nominal dalam USD
$20,00
Tipe Transaksi
Debit Online
Kategori
色
Shopping 0
No. Ref blu
0920 9250 8462
但
Detail
V`;

const SAMPLE_MANDIRI = `From Mandiri
11.51
:... 4G
X
Transfer Berhasil!
31 Agu 2026 • 11:51:49 WIB
Lihat Resi
Makasih mang mobil
Penerima
MOCHAMAD SOLEH
Bank Permata - 1211837353
Nominal
Rp 300.000
dari SYAHRUL ATAUFIK
Tujuan Transaksi
Lainnya
] Bagikan Resi
*+ Simpan ke Daftar
Pembayaran Berhasil!
너지도
OR Baval
Jangan Lupa Ngopi
Hari ini!
Beli sekarang dan bayar pakai QRIS livin
Bayar Sekarang`;

const SAMPLE_JUNK = `halo halo bandung
selamat pagi semua`;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function run(label, text) {
  const result = await groq.chat.completions.create({
    messages: [
      { role: "system", content: buildShortcutPrompt(wallets, categories) },
      { role: "user", content: text },
    ],
    model: process.env.TEST_MODEL ?? "openai/gpt-oss-120b",
    temperature: 0,
    response_format: { type: "json_object" },
  });
  console.log(`\n=== ${label} ===`);
  console.log(result.choices[0]?.message?.content);
}

await run("BLU (expect: RUNPOD.IO, 362304, w-blu, default:belanja, 2026-09-20)", SAMPLE_BLU);
await run("MANDIRI (expect: MOCHAMAD SOLEH-ish, 300000, w-mandiri, lainnya, 2026-08-31)", SAMPLE_MANDIRI);
await run("JUNK (expect: all null)", SAMPLE_JUNK);
