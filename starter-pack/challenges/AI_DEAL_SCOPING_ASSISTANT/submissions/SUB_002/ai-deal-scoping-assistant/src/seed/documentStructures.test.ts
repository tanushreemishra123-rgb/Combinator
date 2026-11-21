import { ARCHITECTURE_AREAS, DATA_TOPICS, PACKAGE_SECTION_IDS, PRD_SECTION_IDS } from '../domain';
import {
  ARCHITECTURE_AREA_SPECS,
  DATA_TOPIC_SPECS,
  FUNCTIONAL_SCOPE_GROUPS,
  PACKAGE_SECTIONS,
  PRD_SECTIONS,
} from './documentStructures';

describe('expected document structures', () => {
  it('gives every PRD section id from the domain a title, in the domain order', () => {
    expect(PRD_SECTIONS.map((section) => section.id)).toEqual([...PRD_SECTION_IDS]);
    for (const section of PRD_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.title).not.toBe(section.id);
    }
  });

  it('gives every architecture area from the domain a label, in the domain order', () => {
    expect(ARCHITECTURE_AREA_SPECS.map((area) => area.id)).toEqual([...ARCHITECTURE_AREAS]);
    for (const area of ARCHITECTURE_AREA_SPECS) {
      expect(area.label.length).toBeGreaterThan(0);
      expect(area.label).not.toBe(area.id);
    }
  });

  it('gives every data topic from the domain a label, in the domain order', () => {
    expect(DATA_TOPIC_SPECS.map((topic) => topic.id)).toEqual([...DATA_TOPICS]);
    for (const topic of DATA_TOPIC_SPECS) {
      expect(topic.label.length).toBeGreaterThan(0);
      expect(topic.label).not.toBe(topic.id);
    }
  });

  it('gives every package section id from the domain a title, in the domain order', () => {
    expect(PACKAGE_SECTIONS.map((section) => section.id)).toEqual([...PACKAGE_SECTION_IDS]);
    for (const section of PACKAGE_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
    }
  });

  it('gives every functional-scope group a name and a non-trivial description', () => {
    expect(FUNCTIONAL_SCOPE_GROUPS.length).toBeGreaterThanOrEqual(4);
    const names = FUNCTIONAL_SCOPE_GROUPS.map((group) => group.name);
    expect(new Set(names).size).toBe(names.length);
    for (const group of FUNCTIONAL_SCOPE_GROUPS) {
      expect(group.description.length).toBeGreaterThan(20);
    }
  });
});
