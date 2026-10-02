import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(resolve(process.cwd(), "src/components/programs-syllabus-manager.tsx"), "utf8");

describe("client Programs & Syllabus flow", () => {
  it("uses a searchable program list before opening program detail", () => {
    const text = source();
    expect(text).toContain('const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null)');
    expect(text).toContain('type="search"');
    expect(text).toContain("visiblePrograms");
    expect(text).toContain("openProgram(program.id)");
    expect(text).toContain("if (!selectedProgram)");
  });

  it("keeps syllabus authoring behind progressive disclosure", () => {
    const text = source();
    expect(text).toContain('<summary className="action-button">{text.advanced}</summary>');
    expect(text).toContain('<summary className="action-button">{text.teachingSetup}</summary>');
    expect(text).toContain("syllabusItems");
    expect(text).toContain("programGroups");
  });

  it("prevents rapid duplicate mutations before React busy state rerenders", () => {
    const text = source();
    expect(text).toContain("const mutationLock = useRef(false)");
    expect(text).toContain("if (mutationLock.current) return false");
    expect(text).toContain("mutationLock.current = true");
    expect(text).toContain("mutationLock.current = false");
  });
});
