export const ROLES = ['super_admin', 'admin', 'customer', 'partner'];

/** Roles that log in to the admin panel. */
export const ADMIN_PANEL_ROLES = ['super_admin', 'admin'];

/** Roles a plain admin may create, edit or assign. Super admins can manage every role. */
export const ADMIN_MANAGEABLE_ROLES = ['customer', 'partner'];

export const canManageRole = (actorRole, targetRole) =>
  actorRole === 'super_admin' || ADMIN_MANAGEABLE_ROLES.includes(targetRole);
