/** Section outline for the integrated package preview (spec "Recommended Application Sections 6"). */
import type { ReactElement } from 'react';
import type { PackageSection } from '../../../domain';

export interface PackageSectionOutlineProps {
  sections: PackageSection[];
  onSelect: (sectionId: string) => void;
}

export function PackageSectionOutline({ sections, onSelect }: PackageSectionOutlineProps): ReactElement {
  return (
    <nav className="package-outline" aria-label="Package section outline">
      <ul className="package-outline-list">
        {sections.map((section) => (
          <li key={section.id}>
            <button type="button" className="package-outline-item" onClick={() => onSelect(section.id)}>
              {section.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
