export function getCounselorInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatCounselorTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}.${String(minutes % 60).padStart(2, "0")}`;
}

export function getCurrentLocalMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
