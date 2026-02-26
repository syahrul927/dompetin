# Workspace Invitation Feature Design

## Context
The user wants to allow workspace owners to invite other users to join their workspace. The MVP flow requires that the invited user is already registered on the platform. Invited users will see pending invitations on their profile screen and can accept or reject them.

## Requirements
1. **Registered Users Only**: The owner can only invite emails that are already registered in the `user` table.
2. **Notification/UI**: The invited user sees a new menu item on the Profile page called "Undangan (New)".
3. **Action**: The invited user can navigate to an invitations page to accept or reject the pending invite.

## Architecture

### 1. Database Schema
We will add a new table `dompetin_invitation`:
- `id`: UUID (Primary Key)
- `workspaceId`: UUID (Foreign Key to `workspace`)
- `email`: VARCHAR(255) (The invited email)
- `role`: ENUM ('admin', 'member', 'viewer') - default to 'member'
- `status`: ENUM ('pending', 'accepted', 'rejected') - default to 'pending'
- `invitedBy`: TEXT (Foreign Key to `user` - who sent it)
- `createdAt`, `updatedAt`

### 2. tRPC Router (`workspace.ts`)
New procedures needed:
- `inviteMember(workspaceId, email)`: Validates if the user is owner/admin, checks if the email is registered, checks if they are already a member, checks if a pending invite already exists, and finally creates the invitation.
- `getPendingInvitations()`: Fetches all `pending` invitations where the `email` matches the currently logged-in user's email.
- `respondToInvitation(invitationId, accept: boolean)`: Updates the invitation status. If accepted, also inserts a new `workspaceMember` record.

### 3. Frontend Implementation
- **InviteMemberDrawer**: Update the existing `InviteMemberDrawer.tsx` to actually call the `inviteMember` mutation, show loading states, and handle "User not registered" errors.
- **Profile Page**: Add a "Undangan Workspace" link. Use `getPendingInvitations` to conditionally show a badge (e.g., "1 New").
- **Invitations Page (`/profile/invitations/page.tsx`)**: A new page listing all pending invitations with "Terima" and "Tolak" buttons.

## Security & Edge Cases
- **Authorization**: Only Workspace Owners (or Admins if configured) can send invites.
- **Duplicate Invites**: Prevent sending an invite if one is already pending for that email in that workspace.
- **Already Member**: Prevent inviting an email if they are already a member of the workspace.
- **Idempotency**: Once an invitation is accepted/rejected, it cannot be responded to again.

## Implementation Plan Handoff
This design will be handed off to the implementation plan generator to create byte-sized tasks for execution.
