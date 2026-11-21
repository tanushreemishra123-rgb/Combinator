import { useEffect, useId, useRef, useState } from 'react';
import type { QuestionId } from '@ai-learning-adventure/types';

export interface QuestionOptionItem {
  id: QuestionId;
  stem: string;
}

export interface QuestionSelectDropdownProps {
  id?: string;
  label?: string;
  value?: QuestionId;
  placeholder?: string;
  questions: QuestionOptionItem[];
  onChange: (questionId?: QuestionId) => void;
  disabled?: boolean;
}

export function QuestionSelectDropdown({
  id,
  label = 'Question',
  value,
  placeholder = 'Choose a question',
  questions,
  onChange,
  disabled = false,
}: QuestionSelectDropdownProps) {
  const autoId = useId();
  const baseId = id ?? `question-select-${autoId}`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const selectedQuestion = questions.find((q) => q.id === value);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() => {
    const idx = questions.findIndex((q) => q.id === value);
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    const idx = questions.findIndex((q) => q.id === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
  }, [value, questions]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listboxRef.current) return;
    const optionElement = listboxRef.current.children[highlightedIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */ as HTMLElement | undefined;
    optionElement?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  function handleSelect(questionId: QuestionId) {
    onChange(questionId);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function handleButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  function handleListboxKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      setIsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev < questions.length - 1 ? prev + 1 : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : questions.length - 1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (questions[highlightedIndex]) /* nosemgrep: gitlab.eslint.detect-object-injection */ {
        handleSelect(questions[highlightedIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */.id);
      }
      return;
    }
  }

  return (
    <div ref={containerRef} className="ai-only-question-dropdown">
      <span id={labelId} className="ai-only-question-dropdown__label">
        {label}
      </span>
      <button
        ref={buttonRef}
        id={baseId}
        type="button"
        role="combobox"
        className={`ai-only-question-dropdown__trigger${isOpen ? ' ai-only-question-dropdown__trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${labelId} ${baseId}`}
        aria-controls={isOpen ? listboxId : undefined}
        disabled={disabled || questions.length === 0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="ai-only-question-dropdown__selected-text">
          {selectedQuestion ? selectedQuestion.stem : placeholder}
        </span>
        <span className="ai-only-question-dropdown__arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          className="ai-only-question-dropdown__listbox"
          role="listbox"
          aria-labelledby={labelId}
          tabIndex={-1}
          onKeyDown={handleListboxKeyDown}
        >
          {questions.map((question, index) => {
            const isSelected = question.id === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={question.id}
                id={`${baseId}-option-${question.id}`}
                role="option"
                aria-selected={isSelected}
                className={`ai-only-question-dropdown__option${
                  isSelected ? ' ai-only-question-dropdown__option--selected' : ''
                }${isHighlighted ? ' ai-only-question-dropdown__option--highlighted' : ''}`}
                onClick={() => handleSelect(question.id)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="ai-only-question-dropdown__option-text">{question.stem}</span>
                {isSelected && (
                  <span className="ai-only-question-dropdown__check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
