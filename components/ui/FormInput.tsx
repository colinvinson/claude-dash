import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

// Standard form input + textarea + select.
// One look across every add / edit surface in the app.

const BASE = "w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700";

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

// Select uses the same base styling for visual consistency with inputs.
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
