import type { ReactNode, SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

function IconBase({ size = 20, children, ...props }: Props & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (props: Props) => <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></IconBase>;
export const GaugeIcon = (props: Props) => <IconBase {...props}><path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><path d="M5.5 18h13"/></IconBase>;
export const SparkIcon = (props: Props) => <IconBase {...props}><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></IconBase>;
export const SignalIcon = (props: Props) => <IconBase {...props}><path d="M5 19v-3"/><path d="M10 19v-6"/><path d="M15 19v-10"/><path d="M20 19V5"/></IconBase>;
export const ArrowIcon = (props: Props) => <IconBase {...props}><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></IconBase>;
export const RefreshIcon = (props: Props) => <IconBase {...props}><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></IconBase>;
export const ExternalIcon = (props: Props) => <IconBase {...props}><path d="M14 5h5v5"/><path d="M10 14 19 5"/><path d="M19 14v5H5V5h5"/></IconBase>;
export const PinIcon = (props: Props) => <IconBase {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></IconBase>;
export const RoadIcon = (props: Props) => <IconBase {...props}><path d="M9 3 7 21"/><path d="m15 3 2 18"/><path d="M12 6v3"/><path d="M12 13v4"/></IconBase>;
export const FilterIcon = (props: Props) => <IconBase {...props}><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></IconBase>;
export const ChevronIcon = (props: Props) => <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>;
export const CloseIcon = (props: Props) => <IconBase {...props}><path d="m6 6 12 12"/><path d="M18 6 6 18"/></IconBase>;
export const ClockIcon = (props: Props) => <IconBase {...props}><circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/></IconBase>;
export const DatabaseIcon = (props: Props) => <IconBase {...props}><ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></IconBase>;
export const ShieldIcon = (props: Props) => <IconBase {...props}><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></IconBase>;
