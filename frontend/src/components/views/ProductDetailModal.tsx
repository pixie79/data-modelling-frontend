/**
 * Product Detail Modal Component
 * Shows detailed information about a data product
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Dialog } from '@/components/common/Dialog';
import { odpsService } from '@/services/sdk/odpsService';
import { browserFileService } from '@/services/platform/browser';
import { useUIStore } from '@/stores/uiStore';
import { sdkLoader } from '@/services/sdk/sdkLoader';
import {
  ExportDropdown,
  YAMLIcon,
  MarkdownIcon,
  PDFIcon,
} from '@/components/common/ExportDropdown';
import type { DataProduct } from '@/types/odps';

export interface ProductDetailModalProps {
  product: DataProduct;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { addToast } = useUIStore();
  const [isExporting, setIsExporting] = useState(false);
  const [pdfExportAvailable, setPdfExportAvailable] = useState(false);

  // Check if PDF export is available when component mounts
  useEffect(() => {
    const checkExportAvailability = async () => {
      try {
        await sdkLoader.load();
        setPdfExportAvailable(sdkLoader.hasODPSExport());
      } catch {
        setPdfExportAvailable(false);
      }
    };
    checkExportAvailability();
  }, []);

  const handleExportYAML = async () => {
    setIsExporting(true);
    try {
      // Get domain name for ODPS export
      const { useModelStore } = await import('@/stores/modelStore');
      const domains = useModelStore.getState().domains;
      const productDomain = domains.find((d) => d.id === product.domain_id);
      const domainName = productDomain?.name || 'unknown';

      const yamlContent = await odpsService.toYAML(product, domainName);
      const filename = `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.odps.yaml`;
      browserFileService.downloadFile(filename, yamlContent, 'text/yaml');
      addToast({
        type: 'success',
        message: `Product "${product.name}" exported successfully`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export product',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    try {
      const markdown = await odpsService.exportToMarkdown(product);

      // Create a blob and download
      const filename = `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      browserFileService.downloadFile(filename, markdown, 'text/markdown');
      addToast({
        type: 'success',
        message: `Product "${product.name}" exported to Markdown successfully`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export to Markdown',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const result = await odpsService.exportToPDF(product);

      // Decode base64 and create blob
      const byteCharacters = atob(result.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        message: `Product "${product.name}" exported to PDF successfully`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to export to PDF',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = useMemo(
    () => [
      {
        id: 'yaml',
        label: 'YAML (.odps.yaml)',
        description: 'Export as ODPS YAML specification',
        icon: <YAMLIcon />,
        onClick: handleExportYAML,
      },
      {
        id: 'markdown',
        label: 'Markdown (.md)',
        description: 'Export as formatted documentation',
        icon: <MarkdownIcon />,
        onClick: handleExportMarkdown,
        disabled: !pdfExportAvailable,
        comingSoon: !pdfExportAvailable,
      },
      {
        id: 'pdf',
        label: 'PDF Document',
        description: 'Branded PDF with OpenDataModelling logo',
        icon: <PDFIcon />,
        onClick: handleExportPDF,
        disabled: !pdfExportAvailable,
        comingSoon: !pdfExportAvailable,
      },
    ],
    [pdfExportAvailable]
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Data Product: ${product.name}`} size="lg">
      <div className="space-y-4">
        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Basic Information</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-gray-600">Name:</span>
              <span className="ml-2 text-sm text-gray-900">{product.name}</span>
            </div>
            {product.description && (
              <div>
                <span className="text-sm font-medium text-gray-600">Description:</span>
                <p className="mt-1 text-sm text-gray-900">
                  {typeof product.description === 'string'
                    ? product.description
                    : JSON.stringify(product.description)}
                </p>
              </div>
            )}
            {product.status && (
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className="ml-2 text-sm text-gray-900 capitalize">{product.status}</span>
              </div>
            )}
            {product.team && (
              <div>
                <span className="text-sm font-medium text-gray-600">Team:</span>
                <span className="ml-2 text-sm text-gray-900">
                  {typeof product.team === 'string'
                    ? product.team
                    : (product.team as any)?.name || JSON.stringify(product.team)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Linked Tables */}
        {product.linked_tables && product.linked_tables.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Linked Tables</h3>
            <div className="space-y-1">
              {product.linked_tables.map((tableId) => (
                <div key={tableId} className="text-sm text-gray-900">
                  {tableId}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Ports */}
        {product.input_ports && product.input_ports.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Input Ports</h3>
            <div className="space-y-2">
              {product.input_ports.map((port, index) => (
                <div key={index} className="bg-gray-50 p-2 rounded">
                  <div className="text-sm font-medium text-gray-900">{port.name}</div>
                  {port.description && (
                    <div className="text-xs text-gray-600 mt-1">{port.description}</div>
                  )}
                  {port.table_id && (
                    <div className="text-xs text-gray-500 mt-1">Table: {port.table_id}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output Ports */}
        {product.output_ports && product.output_ports.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Output Ports</h3>
            <div className="space-y-2">
              {product.output_ports.map((port, index) => (
                <div key={index} className="bg-gray-50 p-2 rounded">
                  <div className="text-sm font-medium text-gray-900">{port.name}</div>
                  {port.description && (
                    <div className="text-xs text-gray-600 mt-1">{port.description}</div>
                  )}
                  {port.table_id && (
                    <div className="text-xs text-gray-500 mt-1">Table: {port.table_id}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Support Information */}
        {product.support && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Support</h3>
            <div className="space-y-1 text-sm text-gray-900">
              {product.support.team && <div>Team: {product.support.team}</div>}
              {product.support.contact && <div>Contact: {product.support.contact}</div>}
              {product.support.slack_channel && <div>Slack: {product.support.slack_channel}</div>}
              {product.support.documentation_url && (
                <div>
                  <a
                    href={product.support.documentation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Documentation
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <ExportDropdown options={exportOptions} isExporting={isExporting} />
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
};
