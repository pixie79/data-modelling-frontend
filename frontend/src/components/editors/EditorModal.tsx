/**
 * Editor Modal Component
 * Popout modal wrapper for BPMN/DMN editors
 * Provides draggable, resizable modal functionality
 */

import React from 'react';
import { DraggableModal } from '@/components/common/DraggableModal';
import { BPMNEditor, type BPMNEditorProps } from './BPMNEditor';
import { DMNEditor, type DMNEditorProps } from './DMNEditor';

export type EditorType = 'bpmn' | 'dmn';

export interface EditorModalProps {
  type: EditorType;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  bpmnProps?: Omit<BPMNEditorProps, 'onClose'>;
  dmnProps?: Omit<DMNEditorProps, 'onClose'>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const EditorModal: React.FC<EditorModalProps> = ({
  type,
  isOpen,
  onClose,
  title,
  bpmnProps,
  dmnProps,
  size = 'xl',
}) => {
  const handleSave = async (xml: string, name: string) => {
    if (type === 'bpmn' && bpmnProps?.onSave) {
      await bpmnProps.onSave(xml, name);
    } else if (type === 'dmn' && dmnProps?.onSave) {
      await dmnProps.onSave(xml, name);
    }
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size === 'full' ? 'xxl' : size}
      noPadding={true}
      resizable={true}
    >
      {type === 'bpmn' && <BPMNEditor {...bpmnProps} onSave={handleSave} onClose={onClose} />}
      {type === 'dmn' && <DMNEditor {...dmnProps} onSave={handleSave} onClose={onClose} />}
    </DraggableModal>
  );
};
