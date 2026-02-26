import { z } from "zod";
import { and, asc, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/server/db";

import {
  workspace,
  workspaceMember,
  invitation,
  user,
} from "@/server/db/schema";

import { protectedProcedure } from "@/server/api/trpc";

/**
 * Workspace tRPC Router
 * Handles workspace management operations
 */
export const workspaceRouter = {
  /**
   * Get all workspaces for the current user
   */
  getWorkspaces: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
      }),
    )
    .query(async ({ ctx }) => {
      // Get all workspace IDs user is a member of
      const userWorkspaces = await db.query.workspaceMember.findMany({
        where: eq(workspaceMember.userId, ctx.session.user.id),
      });

      const workspaceIds = userWorkspaces.map((w) => w.workspaceId);

      // Fetch workspaces
      const workspaces = await db.query.workspace.findMany({
        where: inArray(workspace.id, workspaceIds),
        with: {
          members: {
            orderBy: [asc(workspaceMember.role)],
          },
          wallets: {
            columns: {
              id: true,
            },
          },
        },
      });

      // Transform to response format
      return workspaces.map((w) => ({
        ...w,
        memberCount: w.members.length,
        walletCount: w.wallets.length,
        isOwner: w.ownerId === ctx.session.user.id,
      }));
    }),

  /**
   * Get all members for a specific workspace
   */
  getWorkspaceMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Check if current user has access
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) throw new Error("Access denied");

      // Fetch all members with their user details
      const members = await db.query.workspaceMember.findMany({
        where: eq(workspaceMember.workspaceId, input.workspaceId),
        with: {
          user: {
            columns: {
              name: true,
              email: true,
            }
          }
        },
        orderBy: [desc(workspaceMember.role), asc(workspaceMember.joinedAt)]
      });

      return members;
    }),
  getWorkspace: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this workspace
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.id),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member) {
        throw new Error("Workspace not found or access denied");
      }

      const workspaceData = await db.query.workspace.findFirst({
        where: eq(workspace.id, input.id),
        with: {
          members: true,
          wallets: true,
        },
      });

      if (!workspaceData) {
        throw new Error("Workspace not found");
      }

      return {
        ...workspaceData,
        memberCount: workspaceData.members.length,
        walletCount: workspaceData.wallets.length,
        isOwner: workspaceData.ownerId === ctx.session.user.id,
        userRole: member.role,
      };
    }),

  /**
   * Create a new workspace
   */
  createWorkspace: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        icon: z.string().min(1).max(50).default("💼"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workspaceId = crypto.randomUUID();

      // Create workspace
      const newWorkspace = await db
        .insert(workspace)
        .values({
          id: workspaceId,
          name: input.name,
          icon: input.icon,
          ownerId: ctx.session.user.id,
        })
        .returning();

      // Add owner as member
      await db.insert(workspaceMember).values({
        workspaceId,
        userId: ctx.session.user.id,
        role: "owner",
      });

      return newWorkspace;
    }),

  /**
   * Update an existing workspace
   */
  updateWorkspace: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        icon: z.string().min(1).max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is owner
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.id),
          eq(workspaceMember.userId, ctx.session.user.id),
          eq(workspaceMember.role, "owner"),
        ),
      });

      if (!member) {
        throw new Error("Only workspace owners can update workspace");
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.icon !== undefined) updateData.icon = input.icon;

      // Update workspace
      const updated = await db
        .update(workspace)
        .set(updateData)
        .where(eq(workspace.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a workspace (owner only)
   */
  deleteWorkspace: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user is owner
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.id),
          eq(workspaceMember.userId, ctx.session.user.id),
          eq(workspaceMember.role, "owner"),
        ),
      });

      if (!member) {
        throw new Error("Only workspace owners can delete workspace");
      }

      // Delete workspace (cascades to members, wallets, transactions, etc.)
      await db.delete(workspace).where(eq(workspace.id, input.id));

      return { success: true };
    }),

  /**
   * Get or create a default workspace for the current user.
   * If the user has no workspaces, creates a "Personal" workspace.
   */
  getOrCreateDefault: protectedProcedure.query(async ({ ctx }) => {
    // Check if user already has a workspace
    const existingMembership = await db.query.workspaceMember.findFirst({
      where: eq(workspaceMember.userId, ctx.session.user.id),
    });

    if (existingMembership) {
      const existingWorkspace = await db.query.workspace.findFirst({
        where: eq(workspace.id, existingMembership.workspaceId),
      });
      if (existingWorkspace) return existingWorkspace;
    }

    // Create default workspace
    const workspaceId = crypto.randomUUID();

    const [newWorkspace] = await db
      .insert(workspace)
      .values({
        id: workspaceId,
        name: "Personal",
        icon: "💼",
        ownerId: ctx.session.user.id,
      })
      .returning();

    // Add owner as member
    await db.insert(workspaceMember).values({
      workspaceId,
      userId: ctx.session.user.id,
      role: "owner",
    });

    return newWorkspace!;
  }),

  /**
   * Invite a user to a workspace
   */
  inviteMember: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Verify user is owner or admin
      const member = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, ctx.session.user.id),
        ),
      });

      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        throw new Error("Hanya pemilik atau admin yang dapat mengundang anggota");
      }

      // 2. Check if email is registered
      const targetUser = await db.query.user.findFirst({
        where: eq(user.email, input.email),
      });

      if (!targetUser) {
        throw new Error("Pengguna belum terdaftar di aplikasi");
      }

      // 3. Check if already a member
      const existingMember = await db.query.workspaceMember.findFirst({
        where: and(
          eq(workspaceMember.workspaceId, input.workspaceId),
          eq(workspaceMember.userId, targetUser.id),
        ),
      });

      if (existingMember) {
        throw new Error("Pengguna sudah menjadi anggota workspace ini");
      }

      // 4. Check if pending invitation exists
      const existingInvite = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.workspaceId, input.workspaceId),
          eq(invitation.email, input.email),
          eq(invitation.status, "pending"),
        ),
      });

      if (existingInvite) {
        throw new Error("Undangan sudah dikirim dan sedang menunggu konfirmasi");
      }

      // 5. Create invitation
      const [newInvite] = await db
        .insert(invitation)
        .values({
          workspaceId: input.workspaceId,
          email: input.email,
          role: "member",
          invitedBy: ctx.session.user.id,
        })
        .returning();

      return newInvite;
    }),

  /**
   * Get pending invitations for the current user
   */
  getPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
    // We need user email to find invitations
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, ctx.session.user.id)
    });

    if (!currentUser) throw new Error("User not found");

    return db.query.invitation.findMany({
      where: and(
        eq(invitation.email, currentUser.email),
        eq(invitation.status, "pending")
      ),
      with: {
        workspace: {
          columns: {
            name: true,
            icon: true,
          }
        },
        inviter: {
          columns: {
            name: true,
          }
        }
      },
      orderBy: [desc(invitation.createdAt)]
    });
  }),

  /**
   * Respond to a workspace invitation (accept/reject)
   */
  respondToInvitation: protectedProcedure
    .input(
      z.object({
        invitationId: z.string().uuid(),
        accept: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = await db.query.user.findFirst({
        where: eq(user.id, ctx.session.user.id)
      });

      if (!currentUser) throw new Error("User not found");

      // Verify invitation exists and belongs to user
      const invite = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.id, input.invitationId),
          eq(invitation.email, currentUser.email),
          eq(invitation.status, "pending")
        )
      });

      if (!invite) {
        throw new Error("Undangan tidak valid atau sudah kadaluarsa");
      }

      await db.transaction(async (tx) => {
        // Update invitation status
        await tx.update(invitation)
          .set({
            status: input.accept ? "accepted" : "rejected",
            updatedAt: new Date()
          })
          .where(eq(invitation.id, input.invitationId));

        // If accepted, add to workspace
        if (input.accept) {
          await tx.insert(workspaceMember).values({
            workspaceId: invite.workspaceId,
            userId: ctx.session.user.id,
            role: invite.role,
          });
        }
      });

      return { success: true };
    }),
};
