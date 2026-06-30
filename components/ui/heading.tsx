import * as React from "react";
import { cn } from "@/lib/utils";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export const Heading: React.FC<HeadingProps> = ({ 
  as: Component = "h2", 
  className, 
  children, 
  ...props 
}) => {
  const styles = {
    h1: "text-4xl md:text-6xl lg:text-7xl font-semibold tracking-editorial leading-[1.05] text-balance",
    h2: "text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]",
    h3: "text-2xl md:text-3xl font-medium tracking-tight leading-[1.2]",
    h4: "text-xl md:text-2xl font-medium tracking-tight",
    h5: "text-lg md:text-xl font-medium",
    h6: "text-base md:text-lg font-medium",
  };

  return (
    <Component className={cn(styles[Component], "text-brand-ink", className)} {...props}>
      {children}
    </Component>
  );
};