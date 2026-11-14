export type WorkspaceNavItem = {
  href: string;
  label: string;
  description: string;
};

export const workspaceNavItems: WorkspaceNavItem[] = [
  {
    href: '/',
    label: 'Home',
    description: 'Your AgriShif starting point',
  },
  {
    href: '/assistant',
    label: 'Ask AI',
    description: 'Talk about your farm and local conditions',
  },
  {
    href: '/explorer',
    label: 'Explore',
    description: 'See your area on the map',
  },
  {
    href: '/locations',
    label: 'My Area',
    description: 'Explore places and local context',
  },
];

export const advancedWorkspaceNavItems: WorkspaceNavItem[] = [
  {
    href: '/layers',
    label: 'Environmental layers',
    description: 'Satellite imagery and map overlays',
  },
  {
    href: '/risks',
    label: 'Risk intelligence',
    description: 'Environmental signals and conditions',
  },
  {
    href: '/farms',
    label: 'Farm intelligence',
    description: 'Farm and operational context',
  },
  {
    href: '/crops',
    label: 'Crop planning',
    description: 'Crop and rotation information',
  },
  {
    href: '/reports',
    label: 'Reports and insights',
    description: 'Detailed environmental information',
  },
];
