import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

// Standard form input + textarea + select. ONE look across every add /
// edit surface in the app.
//
// Height: 44px (Apple HIG fingertip minimum). Padding tuned so default
// text doesn't crowd the border. Focus ring uses zinc-600 — distinct
// enough to see, subtle enough not to scream.

const BASE = [
  "w-full",
  "bg-zinc-900 text-zinc-100 placeholder:text-zinc-600",
  "rounded-xl",                              // RADIUS.md territory — see lib/design-tokens
  "px-3.5 py-2.5",                           // ~14/10 px padding, 44pt tall
  "text-sm",
  "outline-none border border-zinc-800",
  "focus:border-zinc-600 focus:bg-zinc-900",
  "transition-colors duration-150",
].join(" ");

export const FormInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function FormInput({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${BASE} ${className}`} {...rest} />;
  },
);

export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function FormTextarea({ className = "", ...rest }, ref) {
    return <textarea ref={ref} className={`${BASE} resize-y ${className}`} {...rest} />;
  },
);

export const FormSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function FormSelect({ className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${BASE} ${className}`} {...rest}>
        {children}
      </select>
    );
  },
);

export default FormInput;
