"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  id: string;
  name: string;
  label: string;

  value?: string;
  onChange?: (value: string) => void;

  placeholder?: string;
  autoComplete?: string;

  required?: boolean;
  minLength?: number;
  disabled?: boolean;

  className?: string;
}

export function PasswordInput({
  id,
  name,
  label,

  value,
  onChange,

  placeholder,
  autoComplete,

  required = false,
  minLength,
  disabled = false,

  className = "",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] =
    useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={
            onChange
              ? (e) => onChange(e.target.value)
              : undefined
          }
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          disabled={disabled}
          className={`w-full rounded-editorial border border-brand-border px-4 py-3 pr-12 ${className}`}
        />

        <button
          type="button"
          onClick={() =>
            setShowPassword((prev) => !prev)
          }
          aria-label={
            showPassword
              ? "Hide password"
              : "Show password"
          }
          className="absolute inset-y-0 right-0 flex items-center px-4 text-brand-muted transition-colors hover:text-brand-ink"
        >
          {showPassword ? (
            <EyeOff size={20} />
          ) : (
            <Eye size={20} />
          )}
        </button>
      </div>
    </div>
  );
}