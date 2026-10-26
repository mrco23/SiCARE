import type { ClientDirectoryCounselor } from "../../../data/mock/clientCounselors";

/** Pure search projection for the client directory; it does not mutate the mock dataset. */
export function filterClientDirectoryCounselors(
  counselors: readonly ClientDirectoryCounselor[],
  searchQuery: string,
): ClientDirectoryCounselor[] {
  const query = searchQuery.trim().toLocaleLowerCase("id-ID");
  if (!query) return [...counselors];

  return counselors.filter((counselor) => {
    const matchesName = counselor.name
      .toLocaleLowerCase("id-ID")
      .includes(query);
    const matchesTopic = counselor.topics.some((topic) =>
      topic.toLocaleLowerCase("id-ID").includes(query),
    );
    return matchesName || matchesTopic;
  });
}
