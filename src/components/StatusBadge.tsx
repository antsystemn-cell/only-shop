import { getStatus, StatusColor, StatusConfig } from "@/lib/statusLabels";

const colorClasses: Record<StatusColor, string> = {
  green:  "bg-green-50  text-green-800  border-green-200",
  amber:  "bg-amber-50  text-amber-800  border-amber-200",
  blue:   "bg-blue-50   text-blue-800   border-blue-200",
  red:    "bg-red-50    text-red-800    border-red-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
  gray:   "bg-gray-100  text-gray-600   border-gray-200",
};

interface Props {
  value: string | null | undefined;
  map: Record<string, StatusConfig>;
  className?: string;
}

export function StatusBadge({ value, map, className = "" }: Props) {
  const { label, color } = getStatus(value, map);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[color]} ${className}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
