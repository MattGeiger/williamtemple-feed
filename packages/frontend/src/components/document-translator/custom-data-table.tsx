// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import React, { useState, useEffect } from "react";
import { ArrowUpDown, Download, Edit, FileText, Languages, Trash2 } from "@/components/ui/icons";
import { Document } from "./types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { TruncatedText } from "@/components/ui/truncated-text";

interface CustomDocumentTableProps {
  documents: Document[];
  isLoading: boolean;
  onEdit: (document: Document) => void;
  onDelete: (document: Document) => void;
  onTranslate: (document: Document) => void;
  onDownload: (document: Document) => void;
  onBulkDelete?: (documents: Document[]) => void;
}

export function CustomDocumentTable({
  documents,
  isLoading,
  onEdit,
  onDelete,
  onTranslate,
  onDownload,
  onBulkDelete
}: CustomDocumentTableProps) {
  const isMobile = useIsMobile();
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showSizeColumn, setShowSizeColumn] = useState(!isMobile);
  const [showTypeColumn, setShowTypeColumn] = useState(!isMobile);
  const [showDateColumn, setShowDateColumn] = useState(!isMobile);
  const pageSize = 10;

  // Update column visibility when screen size changes
  useEffect(() => {
    setShowSizeColumn(!isMobile);
    setShowTypeColumn(!isMobile);
    setShowDateColumn(!isMobile);
  }, [isMobile]);

  // Toggle row selection
  const toggleRowSelection = (id: number) => {
    setSelectedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle all rows selection
  const toggleAllRows = () => {
    const allSelected = documents.every(doc => selectedRows[doc.id]);
    if (allSelected) {
      setSelectedRows({});
    } else {
      const newSelection: Record<number, boolean> = {};
      documents.forEach(doc => {
        newSelection[doc.id] = true;
      });
      setSelectedRows(newSelection);
    }
  };

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    if (sortColumn === "name") {
      const result = a.name.localeCompare(b.name);
      return sortDirection === "asc" ? result : -result;
    } else if (sortColumn === "createdAt") {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    } else if (sortColumn === "type") {
      const typeA = a.type === 'original' ? 0 : 1;
      const typeB = b.type === 'original' ? 0 : 1;
      return sortDirection === "asc" ? typeA - typeB : typeB - typeA;
    }
    return 0;
  });

  // Paginate documents
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedDocuments = sortedDocuments.slice(startIndex, endIndex);

  // Calculate total pages
  const totalPages = Math.ceil(sortedDocuments.length / pageSize);

  // Toggle sort
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get selected documents
  const getSelectedDocuments = () => {
    return documents.filter(doc => selectedRows[doc.id]);
  };

  // Handle bulk delete
  const handleBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(getSelectedDocuments());
    }
  };

  // Create page buttons
  const renderPagination = () => {
    const pages = [];
    
    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= currentPage - 1 && i <= currentPage + 1)
      ) {
        pages.push(
          <Button
            key={i}
            variant={currentPage === i ? "default" : "outline-solid"}
            size="sm"
            onClick={() => setCurrentPage(i)}
          >
            {i}
          </Button>
        );
      } else if (
        (i === 2 && currentPage > 3) || 
        (i === totalPages - 1 && currentPage < totalPages - 2)
      ) {
        pages.push(<span key={i}>...</span>);
      }
    }
    
    return pages;
  };

  return (
    <Card>
      <div className="p-4 flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
        <Input
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        
        {Object.values(selectedRows).some(Boolean) && onBulkDelete && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {getSelectedDocuments().length} selected
            </span>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              className="whitespace-nowrap"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>
      
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={
                      documents.length > 0 && 
                      documents.every(doc => selectedRows[doc.id])
                    }
                    onCheckedChange={toggleAllRows}
                  />
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => toggleSort("name")}
                  >
                    Document Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                
                {showTypeColumn && (
                  <TableHead className="hidden md:table-cell">
                    <Button
                      variant="ghost"
                      onClick={() => toggleSort("type")}
                    >
                      Type
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                )}
                
                {showSizeColumn && (
                  <TableHead className="hidden md:table-cell">
                    Size
                  </TableHead>
                )}
                
                {showDateColumn && (
                  <TableHead className="hidden md:table-cell">
                    <Button
                      variant="ghost"
                      onClick={() => toggleSort("createdAt")}
                    >
                      Last Updated
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                )}
                
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading state
                Array(5).fill(0).map((_, index) => (
                  <TableRow key={`loading-${index}`}>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedDocuments.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No documents found
                  </TableCell>
                </TableRow>
              ) : (
                // Document rows
                paginatedDocuments.map(document => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <Checkbox 
                        checked={!!selectedRows[document.id]}
                        onCheckedChange={() => toggleRowSelection(document.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <TruncatedText text={document.name} maxLength={36} title="View full document name" />
                      {/* Show mobile-only hints about hidden fields */}
                      {isMobile && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {document.type === 'original' ? 'Original' : `Translation (${document.languageName})`}
                          {document.fileSize && ` · ${document.fileSize}`}
                        </div>
                      )}
                    </TableCell>
                    
                    {showTypeColumn && (
                      <TableCell className="hidden md:table-cell">
                        {document.type === 'original' ? 'Original' : `Translation (${document.languageName})`}
                      </TableCell>
                    )}
                    
                    {showSizeColumn && (
                      <TableCell className="hidden md:table-cell">
                        {document.fileSize || '-'}
                      </TableCell>
                    )}
                    
                    {showDateColumn && (
                      <TableCell className="hidden md:table-cell">
                        {new Date(document.createdAt).toLocaleDateString()}
                      </TableCell>
                    )}
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onDownload(document)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        
                        {document.type === 'original' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onTranslate(document)}
                            >
                              <Languages className="h-4 w-4" />
                            </Button>
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onEdit(document)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onDelete(document)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between p-4">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedDocuments.length} of {filteredDocuments.length} documents
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {renderPagination()}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}