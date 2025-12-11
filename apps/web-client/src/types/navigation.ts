export interface NavItem {
  code: string;
  label: string;
  icon: string;
  path?: string;
}

export interface NavSection {
  name: string;
  items: NavItem[];
}

export interface NavigationResponse {
  sections: NavSection[];
  bottomNav: NavItem[];
}
