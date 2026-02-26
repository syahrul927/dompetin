#!/bin/bash

# Generate placeholder PWA icons
# This script creates simple colored square images as placeholders
# Replace with actual icons before production deployment

SIZES=(
  "72"
  "96"
  "128"
  "144"
  "152"
  "192"
  "384"
  "512"
)

COLOR="#000000"
BG_COLOR="#ffffff"

echo "Generating placeholder PWA icons..."

for size in "${SIZES[@]}"; do
  output_file="public/icons/icon-${size}x${size}.png"

  # Check if ImageMagick is available
  if command -v convert &> /dev/null; then
    # Use ImageMagick to create a simple icon
    convert -size ${size}x${size} xc:"$BG_COLOR" \
      -fill "$COLOR" \
      -font Helvetica-Bold \
      -pointsize $((size / 2)) \
      -gravity center \
      -annotate +0+0 "D" \
      "$output_file"
    echo "Created $output_file"
  else
    # Create a dummy file with instructions
    cat > "$output_file" << EOF
This is a placeholder file for icon-${size}x${size}.png

To generate actual PWA icons, you can:

1. Use a design tool to create a 512x512 PNG icon
2. Use an online tool like https://www.pwabuilder.com/imageGenerator
3. Use a CLI tool: pnpm add -D pwa-asset-generator

Example with pwa-asset-generator:
  pnpm exec pwa-asset-generator src/icon.png public/icons/

Required sizes:
${size}x${size}px

EOF
    echo "Created placeholder: $output_file (replace with actual icon)"
  fi
done

echo ""
echo "Icon generation complete!"
echo "Remember to replace placeholder icons with actual icons before deployment."
