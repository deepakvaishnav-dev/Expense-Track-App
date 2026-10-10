import React from 'react';
import { Svg, Path, Rect, Circle } from 'react-native-svg';

interface IconProps {
  color: string;
  focused?: boolean;
}

export const HomeIcon: React.FC<IconProps> = ({ color, focused = false }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 10.182V20a1 1 0 001 1h5v-6h6v6h5a1 1 0 001-1v-9.818a1 1 0 00-.379-.784l-8-6.154a1 1 0 00-1.242 0l-8 6.154A1 1 0 003 10.182z"
      stroke={color}
      strokeWidth={focused ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `${color}18` : 'none'}
    />
  </Svg>
);

export const HistoryIcon: React.FC<IconProps> = ({ color, focused = false }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Rect
      x="3"
      y="4"
      width="18"
      height="17"
      rx="2.5"
      stroke={color}
      strokeWidth={focused ? '2.2' : '1.8'}
      fill={focused ? `${color}18` : 'none'}
    />
    <Path d="M16 2v4M8 2v4M3 9h18" stroke={color} strokeWidth={focused ? '2.2' : '1.8'} strokeLinecap="round" />
    <Circle cx="8" cy="13" r="1.2" fill={color} />
    <Circle cx="12" cy="13" r="1.2" fill={color} />
    <Circle cx="16" cy="13" r="1.2" fill={color} />
    <Circle cx="8" cy="17" r="1.2" fill={color} />
    <Circle cx="12" cy="17" r="1.2" fill={color} />
  </Svg>
);

export const KhataIcon: React.FC<IconProps> = ({ color, focused = false }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 19.5v-15A2.5 2.5 0 016.5 2H20v20H6.5a2.5 2.5 0 01-2.5-2.5z"
      stroke={color}
      strokeWidth={focused ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={focused ? `${color}18` : 'none'}
    />
    <Path
      d="M7 6h9M7 10h9M7 14h6"
      stroke={color}
      strokeWidth={focused ? '2' : '1.8'}
      strokeLinecap="round"
    />
  </Svg>
);

export const ProfileIcon: React.FC<IconProps> = ({ color, focused = false }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
      stroke={color}
      strokeWidth={focused ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle
      cx="12"
      cy="7"
      r="4"
      stroke={color}
      strokeWidth={focused ? '2.2' : '1.8'}
      fill={focused ? `${color}18` : 'none'}
    />
  </Svg>
);

export const PlusIcon: React.FC<{ color?: string }> = ({ color = '#ffffff' }) => (
  <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5v14M5 12h14"
      stroke={color}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
