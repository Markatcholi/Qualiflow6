// Administrative authority comes from company access, never editable QMS role names.
export function companyAuthorityLabel(isAdministrator: boolean, roleNames: string[]) {
  const authority = isAdministrator ? "Company Administrator" : "Company Member";
  return roleNames.length ? `${authority} · QMS roles: ${roleNames.join(", ")}` : authority;
}
