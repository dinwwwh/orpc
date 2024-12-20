import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { TerminalIcon } from 'lucide-react'

export function IconContainer({
  icon: Icon,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon?: React.FC
}): React.ReactElement {
  return (
    <div
      {...props}
      className={cn(
        'rounded-md border bg-gradient-to-b from-fd-secondary p-1 shadow-sm',
        props.className,
      )}
    >
      {Icon ? <Icon /> : <TerminalIcon />}
    </div>
  )
}
