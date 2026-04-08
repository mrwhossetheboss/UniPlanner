import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const suggestCategory = (title: string, description: string) => {
  const text = (title + " " + description).toLowerCase();
  if (text.includes("math") || text.includes("calc") || text.includes("algebra")) return "Math";
  if (text.includes("code") || text.includes("program") || text.includes("dev") || text.includes("react") || text.includes("python") || text.includes("script")) return "Coding";
  if (text.includes("exam") || text.includes("test") || text.includes("quiz") || text.includes("midterm") || text.includes("final")) return "Exam";
  if (text.includes("read") || text.includes("book") || text.includes("essay") || text.includes("write") || text.includes("chapter")) return "Reading";
  return "General";
};
