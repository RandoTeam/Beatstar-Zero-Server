export const handlePlaceholders = (
  obj: any,
  replacements: Record<string, any>
) => {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (typeof replacements !== "object" || replacements === null) {
    return obj;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string" && value in replacements) {
      obj[key] = replacements[value];
    } else if (typeof value === "object") {
      handlePlaceholders(value, replacements);
    }
  }

  return obj;
};
