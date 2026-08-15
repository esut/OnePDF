import { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'

// تحديث واجهة البيانات لدعم التدوير
interface PageItem {
  id: string;
  fileId: string;
  filename: string;
  originalPageNumber: number;
  fileColor: string;
  fileBuffer: ArrayBuffer;
  rotation: number; // لحفظ زاوية الدوران (0, 90, 180, 270)
}
// ... (واجهة PageItem والـ COLORS كما هي)
interface PageItem {
  id: string; fileId: string; filename: string; originalPageNumber: number;
  fileColor: string; fileBuffer: ArrayBuffer; rotation: number;
}
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

function App() {
  const [outputFileName, setOutputFileName] = useState('My_Merged_Document')
  const [pages, setPages] = useState<PageItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  const [addPageNumbers, setAddPageNumbers] = useState(false) // حالة ترقيم الصفحات
  // --- حالات المساحة الجانبية الجديدة ---
  const [sidebarWidth, setSidebarWidth] = useState(260); // العرض الافتراضي
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
// --- الحالة الجديدة: تحديد مساحة العمل النشطة ---
  const [activeWorkspace, setActiveWorkspace] = useState<'STUDIO' | 'EDITOR'>('STUDIO')
  const [activeTool, setActiveTool] = useState('select') // الأداة النشطة في المحرر

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setIsProcessing(true);
    
    const newPages: PageItem[] = [];
    let currentFileCount = fileCount;

    for (const file of Array.from(event.target.files)) {
      const color = COLORS[currentFileCount % COLORS.length];
      const fileId = `file_${Date.now()}_${Math.random()}`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pageCount = pdfDoc.getPageCount();

      for (let i = 0; i < pageCount; i++) {
        newPages.push({
          id: `${fileId}_page_${i + 1}`,
          fileId,
          filename: file.name,
          originalPageNumber: i + 1,
          fileColor: color,
          fileBuffer: arrayBuffer,
          rotation: 0 // التدوير الافتراضي
        });
      }
      currentFileCount++;
    }

    setPages((prev) => [...prev, ...newPages]);
    setFileCount(currentFileCount);
    setIsProcessing(false);
    event.target.value = '';
  }

  // --- دوال التحكم الفردي ---
  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }

  const rotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((page, i) =>
        i === index ? { ...page, rotation: (page.rotation + 90) % 360 } : page
      )
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPages = [...pages];
    [newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]];
    setPages(newPages);
  }

  const moveDown = (index: number) => {
    if (index === pages.length - 1) return;
    const newPages = [...pages];
    [newPages[index + 1], newPages[index]] = [newPages[index], newPages[index + 1]];
    setPages(newPages);
  }

  // --- دوال التحكم الجماعي (Bulk Actions) ---
  const rotateAll = () => {
    setPages((prev) => prev.map(page => ({ ...page, rotation: (page.rotation + 90) % 360 })));
  }

  const clearAll = () => {
    if(window.confirm('Are you sure you want to remove all pages?')) {
      setPages([]);
    }
  }

  // --- دوال السحب والإفلات ---
  const handleDragStart = (index: number) => { dragItem.current = index; }
  const handleDragEnter = (index: number) => { dragOverItem.current = index; }
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newPages = [...pages];
      const draggedItemContent = newPages[dragItem.current];
      newPages.splice(dragItem.current, 1);
      newPages.splice(dragOverItem.current, 0, draggedItemContent);
      setPages(newPages);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }

  // --- تصدير الملف النهائي مع التدوير والترقيم ---
  const exportPDF = async () => {
    if (pages.length === 0) return;
    setIsProcessing(true);
    
    try {
      const finalPdf = await PDFDocument.create();
      const loadedDocs = new Map<string, PDFDocument>();
      // تحميل الخط الافتراضي للأرقام
      const font = await finalPdf.embedFont(StandardFonts.HelveticaBold);

      for (let i = 0; i < pages.length; i++) {
        const pageItem = pages[i];
        if (!loadedDocs.has(pageItem.fileId)) {
          const doc = await PDFDocument.load(pageItem.fileBuffer);
          loadedDocs.set(pageItem.fileId, doc);
        }
        const sourceDoc = loadedDocs.get(pageItem.fileId)!;
        const [copiedPage] = await finalPdf.copyPages(sourceDoc, [pageItem.originalPageNumber - 1]);
        
        // 1. تطبيق التدوير
        if (pageItem.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees(currentRotation + pageItem.rotation));
        }

        // 2. إضافة رقم الصفحة
        if (addPageNumbers) {
          const { width } = copiedPage.getSize();
          const text = `${i + 1}`;
          const textSize = 14;
          const textWidth = font.widthOfTextAtSize(text, textSize);
          
          copiedPage.drawText(text, {
            x: width / 2 - textWidth / 2, // التوسيط
            y: 20, // المسافة من الأسفل
            size: textSize,
            font: font,
            color: rgb(0.2, 0.2, 0.2), // لون رمادي داكن
          });
        }

        finalPdf.addPage(copiedPage);
      }

      const pdfBytes = await finalPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${outputFileName || 'Document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting PDF.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }
// --- دالة التحكم في سحب القائمة الجانبية ---
  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 200) newWidth = 200; // الحد الأدنى للعرض
      if (newWidth > 500) newWidth = 500; // الحد الأقصى للعرض
      setSidebarWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  return (
  <div className="app-container">
    {/* القائمة الجانبية */}
    <aside
      className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ width: isSidebarCollapsed ? 80 : sidebarWidth }}
    >
      {/* الشريط العلوي */}
      <div className="sidebar-top-bar">
        <div
          className="logo-area"
          style={{
            opacity: isSidebarCollapsed ? 0 : 1,
            width: isSidebarCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          }}
        >
          <svg
            className="logo-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>

          <h2>
            OnePDF <span>Vault</span>
          </h2>
        </div>

        <button
          className="toggle-sidebar-btn"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title="Toggle Sidebar"
        >
          {isSidebarCollapsed ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="13 17 18 12 13 7" />
              <polyline points="6 17 11 12 6 7" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Workspace */}
      <div className="menu-section">
        {!isSidebarCollapsed && (
          <p className="section-title">WORKSPACE</p>
        )}

        <ul className="menu-list">

          {/* PDF STUDIO */}
          <li
            className={`menu-item ${
              activeWorkspace === 'STUDIO' ? 'active' : ''
            }`}
            onClick={() => setActiveWorkspace('STUDIO')}
            title={isSidebarCollapsed ? 'PDF Studio' : ''}
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                ry="2"
              />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>

            <span
              className="menu-text"
              style={{
                opacity: isSidebarCollapsed ? 0 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              PDF Studio
            </span>
          </li>

          {/* PDF EDITOR */}
          <li
            className={`menu-item ${
              activeWorkspace === 'EDITOR' ? 'active' : ''
            }`}
            onClick={() => setActiveWorkspace('EDITOR')}
            title={isSidebarCollapsed ? 'PDF Editor' : ''}
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>

            <span
              className="menu-text"
              style={{
                opacity: isSidebarCollapsed ? 0 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              PDF Editor
            </span>
          </li>

        </ul>
      </div>

      {!isSidebarCollapsed && (
        <div
          className="sidebar-resizer"
          onMouseDown={startResizing}
        />
      )}
    </aside>

    {/* ========================================================= */}
    {/* MAIN WORKSPACE */}
    {/* ========================================================= */}

    <main className="main-workspace">

      {/* ======================================================= */}
      {/* PDF STUDIO */}
      {/* ======================================================= */}

      {activeWorkspace === 'STUDIO' && (
        <>
          <header className="workspace-header studio-header">
            <div>
              <h1>PDF Studio</h1>
              <p>
                Upload, reorder, rotate, merge, and add page numbers visually.
              </p>
            </div>

            <div className="header-actions">

              {pages.length > 0 && (
                <>
                  {/* اسم الملف */}
                  <div className="filename-input-wrapper">
                    <input
                      type="text"
                      value={outputFileName}
                      onChange={(e) =>
                        setOutputFileName(e.target.value)
                      }
                      placeholder="Enter file name..."
                      className="filename-input"
                    />

                    <span className="extension">.pdf</span>
                  </div>

                  {/* ترقيم الصفحات */}
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={addPageNumbers}
                      onChange={(e) =>
                        setAddPageNumbers(e.target.checked)
                      }
                    />

                    <span className="slider"></span>

                    <span className="toggle-label">
                      Add Page Numbers
                    </span>
                  </label>
                </>
              )}

              {/* رفع الملفات */}
              <label className="upload-btn small-btn">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>

                Add Files

                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {/* التصدير */}
              {pages.length > 0 && (
                <button
                  className="action-btn export-btn"
                  onClick={exportPDF}
                  disabled={isProcessing}
                >
                  {isProcessing
                    ? 'Processing...'
                    : 'Export Final PDF'}
                </button>
              )}
            </div>
          </header>

          {/* الحالة الفارغة */}
          {pages.length === 0 && !isProcessing ? (
            <div className="empty-studio">
              <div className="drop-zone studio-drop">

                <svg
                  className="upload-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>

                <h3>Start your Workspace</h3>

                <p>
                  Upload PDF files to start organizing,
                  merging, and splitting pages.
                </p>

                <label className="upload-btn">
                  Browse PDF Files

                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <>
              {/* Bulk Toolbar */}
              <div className="bulk-toolbar">

                <span>
                  {pages.length} Pages Loaded
                </span>

                <div className="bulk-actions">

                  <button
                    onClick={rotateAll}
                    className="bulk-btn"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>

                    Rotate All
                  </button>

                  <button
                    onClick={clearAll}
                    className="bulk-btn text-danger"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>

                    Clear All
                  </button>

                </div>
              </div>

              {/* Pages */}
              <div className="pages-grid">

                {pages.map((page, index) => (
                  <div
                    key={page.id}
                    className="page-card"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) =>
                      e.preventDefault()
                    }
                  >

                    <div
                      className="page-card-header"
                      style={{
                        borderBottomColor:
                          page.fileColor
                      }}
                    >
                      <span
                        className="file-badge"
                        style={{
                          backgroundColor:
                            `${page.fileColor}20`,
                          color:
                            page.fileColor
                        }}
                      >
                        {page.filename}
                      </span>
                    </div>

                    <div className="page-content">

                      <svg
                        className="page-placeholder"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={page.fileColor}
                        strokeWidth="1.5"
                        style={{
                          transform:
                            `rotate(${page.rotation}deg)`,
                          transition:
                            'transform 0.3s ease'
                        }}
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>

                      <h4>
                        Page {page.originalPageNumber}
                      </h4>

                      {page.rotation !== 0 && (
                        <span className="rotation-badge">
                          {page.rotation}°
                        </span>
                      )}
                    </div>

                    <div className="page-actions">

                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        title="Move Left/Up"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>

                      <button
                        onClick={() => moveDown(index)}
                        disabled={
                          index === pages.length - 1
                        }
                        title="Move Right/Down"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      <button
                        onClick={() => rotatePage(index)}
                        className="rotate-btn"
                        title="Rotate 90°"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      </button>

                      <button
                        onClick={() => removePage(index)}
                        className="delete-page-btn"
                        title="Delete Page"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line
                            x1="18"
                            y1="6"
                            x2="6"
                            y2="18"
                          />
                          <line
                            x1="6"
                            y1="6"
                            x2="18"
                            y2="18"
                          />
                        </svg>
                      </button>

                    </div>
                  </div>
                ))}

              </div>
            </>
          )}
        </>
      )}

      {/* ======================================================= */}
      {/* PDF EDITOR */}
      {/* ======================================================= */}

      {activeWorkspace === 'EDITOR' && (
        <div className="editor-workspace">

          {/* Toolbar */}
          <header className="editor-toolbar">

            <div className="tools-group">

              {/* Select */}
              <button
                className={`tool-btn ${
                  activeTool === 'select'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('select')
                }
                title="Select Object"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                  <path d="M13 13l6 6" />
                </svg>
              </button>

              <div className="tool-divider"></div>

              {/* Text */}
              <button
                className={`tool-btn ${
                  activeTool === 'text'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('text')
                }
                title="Add Text"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line
                    x1="9"
                    y1="20"
                    x2="15"
                    y2="20"
                  />
                  <line
                    x1="12"
                    y1="4"
                    x2="12"
                    y2="20"
                  />
                </svg>
              </button>

              {/* Draw */}
              <button
                className={`tool-btn ${
                  activeTool === 'draw'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('draw')
                }
                title="Freehand Draw"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle
                    cx="11"
                    cy="11"
                    r="2"
                  />
                </svg>
              </button>

              {/* Highlight */}
              <button
                className={`tool-btn ${
                  activeTool === 'highlight'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('highlight')
                }
                title="Highlight Text"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                </svg>
              </button>

              <div className="tool-divider"></div>

              {/* Image */}
              <button
                className={`tool-btn ${
                  activeTool === 'image'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('image')
                }
                title="Insert Image"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>

              {/* Signature */}
              <button
                className={`tool-btn ${
                  activeTool === 'signature'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTool('signature')
                }
                title="Add Signature"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>

            </div>

            <div className="tools-group">

              <button
                className="action-btn save-btn"
                onClick={() => {
                  // سيتم ربطها لاحقاً بحفظ تعديلات المحرر
                  console.log('Save editor changes');
                }}
              >
                Save Changes
              </button>

            </div>

          </header>

          {/* Editor Main */}
          <div className="editor-main-area">

            {/* Canvas */}
            <div className="canvas-container">

              {pages.length === 0 ? (
                <div className="mock-pdf-page">
                  <div className="mock-placeholder">

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>

                    <p>
                      Upload a PDF from Studio
                      to start editing.
                    </p>

                    <small>
                      No PDF loaded
                    </small>

                    <button
                      className="upload-btn"
                      onClick={() =>
                        setActiveWorkspace('STUDIO')
                      }
                    >
                      Open PDF Studio
                    </button>

                  </div>
                </div>
              ) : (
                <div className="mock-pdf-page">

                  <div className="editor-page-header">
                    <span>
                      Page 1
                    </span>

                    <span>
                      {pages.length} pages
                    </span>
                  </div>

                  <div className="mock-pdf-content">

                    {/* مساحة التحرير */}
                    <div
                      className={`editor-canvas ${
                        activeTool !== 'select'
                          ? `tool-${activeTool}`
                          : ''
                      }`}
                    >

                      {/* مثال للنص */}
                      {activeTool === 'text' && (
                        <div className="editor-helper-box">
                          Click anywhere on the page
                          to add text
                        </div>
                      )}

                      {/* مثال للرسم */}
                      {activeTool === 'draw' && (
                        <div className="editor-helper-box">
                          Draw freely on the PDF
                        </div>
                      )}

                      {/* التظليل */}
                      {activeTool === 'highlight' && (
                        <div className="editor-helper-box highlight-helper">
                          Select text to highlight
                        </div>
                      )}

                      {/* الصورة */}
                      {activeTool === 'image' && (
                        <div className="editor-helper-box">
                          Choose an image to insert
                        </div>
                      )}

                      {/* التوقيع */}
                      {activeTool === 'signature' && (
                        <div className="editor-helper-box">
                          Add your signature
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* Properties Panel */}
            <aside className="properties-panel">

              <div className="properties-header">
                <h3>Properties</h3>
              </div>

              {/* SELECT */}
              {activeTool === 'select' && (
                <div className="property-group">

                  <p className="hint-text">
                    Select an object on the page
                    to change its properties
                    or delete it.
                  </p>

                  <div className="property-divider"></div>

                  <button
                    className="danger-action-btn"
                    disabled
                  >
                    Delete Selected
                  </button>

                </div>
              )}

              {/* TEXT */}
              {activeTool === 'text' && (
                <div className="property-group">

                  <label>
                    Font Size
                  </label>

                  <input
                    type="range"
                    min="8"
                    max="72"
                    defaultValue="14"
                    className="custom-slider"
                  />

                  <div className="range-value">
                    14 px
                  </div>

                  <label>
                    Font Family
                  </label>

                  <select className="property-select">
                    <option>Arial</option>
                    <option>Helvetica</option>
                    <option>Times New Roman</option>
                    <option>Georgia</option>
                    <option>Courier New</option>
                  </select>

                  <label>
                    Text Color
                  </label>

                  <div className="color-picker-mock">

                    <span
                      className="color-swatch active"
                      style={{
                        background: '#000000'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#ef4444'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#3b82f6'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#22c55e'
                      }}
                    />

                  </div>

                  <div className="text-style-buttons">

                    <button>
                      B
                    </button>

                    <button>
                      <i>I</i>
                    </button>

                    <button>
                      <u>U</u>
                    </button>

                  </div>

                </div>
              )}

              {/* DRAW */}
              {activeTool === 'draw' && (
                <div className="property-group">

                  <label>
                    Stroke Width
                  </label>

                  <input
                    type="range"
                    min="1"
                    max="20"
                    defaultValue="3"
                    className="custom-slider"
                  />

                  <div className="range-value">
                    3 px
                  </div>

                  <label>
                    Stroke Color
                  </label>

                  <div className="color-picker-mock">

                    <span
                      className="color-swatch active"
                      style={{
                        background: '#000000'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#ef4444'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#3b82f6'
                      }}
                    />

                  </div>

                </div>
              )}

              {/* HIGHLIGHT */}
              {activeTool === 'highlight' && (
                <div className="property-group">

                  <label>
                    Highlight Color
                  </label>

                  <div className="color-picker-mock">

                    <span
                      className="color-swatch active"
                      style={{
                        background: '#fde047'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#86efac'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#93c5fd'
                      }}
                    />

                    <span
                      className="color-swatch"
                      style={{
                        background: '#f9a8d4'
                      }}
                    />

                  </div>

                  <label>
                    Opacity
                  </label>

                  <input
                    type="range"
                    min="10"
                    max="100"
                    defaultValue="45"
                    className="custom-slider"
                  />

                </div>
              )}

              {/* IMAGE */}
              {activeTool === 'image' && (
                <div className="property-group">

                  <label>
                    Image
                  </label>

                  <label className="upload-btn property-upload-btn">
                    Choose Image

                    <input
                      type="file"
                      accept="image/*"
                      style={{
                        display: 'none'
                      }}
                      onChange={(e) => {
                        const file =
                          e.target.files?.[0];

                        if (file) {
                          console.log(
                            'Selected image:',
                            file
                          );
                        }
                      }}
                    />
                  </label>

                  <label>
                    Opacity
                  </label>

                  <input
                    type="range"
                    min="10"
                    max="100"
                    defaultValue="100"
                    className="custom-slider"
                  />

                </div>
              )}

              {/* SIGNATURE */}
              {activeTool === 'signature' && (
                <div className="property-group">

                  <label>
                    Signature
                  </label>

                  <div className="signature-box">
                    <span>
                      Sign here
                    </span>
                  </div>

                  <button className="upload-btn property-upload-btn">
                    Create Signature
                  </button>

                  <button className="secondary-action-btn">
                    Upload Signature
                  </button>

                </div>
              )}

            </aside>

          </div>

        </div>
      )}

    </main>
  </div>
)
}

export default App
