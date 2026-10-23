import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  ...props
}: React.PropsWithChildren<
  {
    as?: React.ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
  } & React.HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (currentDirection: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const index = directions.indexOf(currentDirection);
    const nextIndex = clockwise
      ? (index - 1 + directions.length) % directions.length
      : (index + 1) % directions.length;
    return directions[nextIndex];
  };

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(243, 75%, 59%) 0%, rgba(99, 102, 241, 0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(243, 75%, 59%) 0%, rgba(99, 102, 241, 0) 100%)",
    BOTTOM:
      "radial-gradient(20.7% 50% at 50% 100%, hsl(243, 75%, 59%) 0%, rgba(99, 102, 241, 0) 100%)",
    RIGHT:
      "radial-gradient(16.2% 41.2% at 100% 50%, hsl(243, 75%, 59%) 0%, rgba(99, 102, 241, 0) 100%)",
  };

  const highlight =
    "radial-gradient(75% 181.159% at 50% 50%, #4F46E5 0%, rgba(255, 255, 255, 0) 100%)";

  useEffect(() => {
    if (!hovered) {
      const interval = setInterval(() => {
        setDirection((prevState) => rotateDirection(prevState));
      }, duration * 1000);
      return () => clearInterval(interval);
    }
  }, [hovered, duration]);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex rounded-full border border-indigo-200/60 content-center bg-indigo-50/40 hover:bg-indigo-100/40 transition duration-500 items-center flex-col flex-nowrap gap-10 h-min justify-center overflow-visible p-px decoration-clone w-fit cursor-pointer",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "w-auto text-slate-800 z-10 bg-white px-3.5 py-1.5 rounded-[inherit] text-xs font-semibold flex items-center gap-1.5 shadow-xs",
          className
        )}
      >
        {children}
      </div>
      <motion.div
        className={cn(
          "flex-none inset-0 overflow-hidden absolute z-0 rounded-[inherit]"
        )}
        style={{
          filter: "blur(2px)",
          position: "absolute",
          width: "100%",
          height: "100%",
        }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered
            ? [movingMap[direction], highlight]
            : movingMap[direction],
        }}
        transition={{ ease: "linear", duration: duration ?? 1 }}
      />
      <div className="bg-white/80 absolute z-[1] flex-none inset-[1px] rounded-[100px]" />
    </Tag>
  );
}
