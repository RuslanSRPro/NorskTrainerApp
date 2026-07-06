import { ReactNode } from 'react';

import { WallpaperLayer } from '@/design-system/wallpaper';

type Props = {
  children: ReactNode;
  dark?: boolean;
};

export function HomeBackground({ children, dark = false }: Props) {
  return <WallpaperLayer dark={dark}>{children}</WallpaperLayer>;
}