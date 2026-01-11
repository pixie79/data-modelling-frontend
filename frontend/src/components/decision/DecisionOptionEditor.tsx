/**
 * Decision Option Editor Component
 * Allows editing of decision options with pros and cons
 */

import React from 'react';
import type { DecisionOption } from '@/types/decision';

export interface DecisionOptionEditorProps {
  options: DecisionOption[];
  onChange: (options: DecisionOption[]) => void;
  disabled?: boolean;
}

export const DecisionOptionEditor: React.FC<DecisionOptionEditorProps> = ({
  options,
  onChange,
  disabled = false,
}) => {
  const handleAddOption = () => {
    onChange([...options, { title: '', description: '', pros: [], cons: [] }]);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...options];
    newOptions.splice(index, 1);
    onChange(newOptions);
  };

  const handleOptionChange = (
    index: number,
    field: keyof DecisionOption,
    value: string | string[]
  ) => {
    const newOptions = [...options];
    const currentOption = newOptions[index];
    if (currentOption) {
      newOptions[index] = { ...currentOption, [field]: value };
      onChange(newOptions);
    }
  };

  const handleAddPro = (optionIndex: number) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      newOptions[optionIndex] = {
        ...currentOption,
        pros: [...currentOption.pros, ''],
      };
      onChange(newOptions);
    }
  };

  const handleRemovePro = (optionIndex: number, proIndex: number) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      const newPros = [...currentOption.pros];
      newPros.splice(proIndex, 1);
      newOptions[optionIndex] = { ...currentOption, pros: newPros };
      onChange(newOptions);
    }
  };

  const handleProChange = (optionIndex: number, proIndex: number, value: string) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      const newPros = [...currentOption.pros];
      newPros[proIndex] = value;
      newOptions[optionIndex] = { ...currentOption, pros: newPros };
      onChange(newOptions);
    }
  };

  const handleAddCon = (optionIndex: number) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      newOptions[optionIndex] = {
        ...currentOption,
        cons: [...currentOption.cons, ''],
      };
      onChange(newOptions);
    }
  };

  const handleRemoveCon = (optionIndex: number, conIndex: number) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      const newCons = [...currentOption.cons];
      newCons.splice(conIndex, 1);
      newOptions[optionIndex] = { ...currentOption, cons: newCons };
      onChange(newOptions);
    }
  };

  const handleConChange = (optionIndex: number, conIndex: number, value: string) => {
    const newOptions = [...options];
    const currentOption = newOptions[optionIndex];
    if (currentOption) {
      const newCons = [...currentOption.cons];
      newCons[conIndex] = value;
      newOptions[optionIndex] = { ...currentOption, cons: newCons };
      onChange(newOptions);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Considered Options</h3>
        <button
          type="button"
          onClick={handleAddOption}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Option
        </button>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No options defined. Add options to document alternatives considered.
        </p>
      ) : (
        <div className="space-y-6">
          {options.map((option, optionIndex) => (
            <div key={optionIndex} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              {/* Option Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Option {optionIndex + 1} Title
                  </label>
                  <input
                    type="text"
                    value={option.title}
                    onChange={(e) => handleOptionChange(optionIndex, 'title', e.target.value)}
                    disabled={disabled}
                    placeholder="e.g., Use PostgreSQL"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveOption(optionIndex)}
                  disabled={disabled}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove option"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>

              {/* Option Description */}
              <div className="mb-4">
                <label
                  htmlFor={`option-${optionIndex}-description`}
                  className="block text-xs font-medium text-gray-600 mb-1"
                >
                  Description
                </label>
                <textarea
                  id={`option-${optionIndex}-description`}
                  value={option.description}
                  onChange={(e) => handleOptionChange(optionIndex, 'description', e.target.value)}
                  disabled={disabled}
                  placeholder="Describe this option..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Pros and Cons Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Pros */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-green-700 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Pros
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleAddPro(optionIndex)}
                      disabled={disabled}
                      className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {option.pros.map((pro, proIndex) => (
                      <div key={proIndex} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={pro}
                          onChange={(e) => handleProChange(optionIndex, proIndex, e.target.value)}
                          disabled={disabled}
                          placeholder="Pro..."
                          className="flex-1 px-2 py-1 text-sm border border-green-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePro(optionIndex, proIndex)}
                          disabled={disabled}
                          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {option.pros.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No pros listed</p>
                    )}
                  </div>
                </div>

                {/* Cons */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-red-700 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Cons
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleAddCon(optionIndex)}
                      disabled={disabled}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {option.cons.map((con, conIndex) => (
                      <div key={conIndex} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={con}
                          onChange={(e) => handleConChange(optionIndex, conIndex, e.target.value)}
                          disabled={disabled}
                          placeholder="Con..."
                          className="flex-1 px-2 py-1 text-sm border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCon(optionIndex, conIndex)}
                          disabled={disabled}
                          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {option.cons.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No cons listed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
