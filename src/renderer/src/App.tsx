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
      <aside 
        className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: isSidebarCollapsed ? 80 : sidebarWidth }}
      >
        <div className="sidebar-top-bar">
          <div className="logo-area" style={{ opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : 'auto', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h2>OnePDF <span>Vault</span></h2>
          </div>
          
          <button className="toggle-sidebar-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} title="Toggle Sidebar">
            {isSidebarCollapsed ? (
              // أيقونة الفتح
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
            ) : (
               // أيقونة الطي
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
            )}
          </button>
        </div>

        <div className="menu-section">
          {!isSidebarCollapsed && <p className="section-title">WORKSPACE</p>}
          <ul className="menu-list">
            <li className="menu-item active" title={isSidebarCollapsed ? "PDF Studio" : ""}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              <span className="menu-text" style={{ opacity: isSidebarCollapsed ? 0 : 1, transition: 'opacity 0.2s' }}>PDF Studio</span>
            </li>
          </ul>
        </div>

        {/* مقبض السحب لتغيير الحجم */}
        {!isSidebarCollapsed && (
          <div className="sidebar-resizer" onMouseDown={startResizing}></div>
        )}
      </aside>

      <main className="main-workspace">
        <header className="workspace-header studio-header">
          <div>
            <h1>PDF Studio</h1>
            <p>Upload, reorder, rotate, merge, and add page numbers visually.</p>
          </div>
          <div className="header-actions">
            {pages.length > 0 && (
              <>
              {/* الميزة الجديدة: حقل تسمية الملف */}
                <div className="filename-input-wrapper">
                  <input 
                    type="text" 
                    value={outputFileName} 
                    onChange={(e) => setOutputFileName(e.target.value)}
                    placeholder="Enter file name..."
                    className="filename-input"
                  />
                  <span className="extension">.pdf</span>
                </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={addPageNumbers} onChange={(e) => setAddPageNumbers(e.target.checked)} />
                <span className="slider"></span>
                <span className="toggle-label">Add Page Numbers</span>
              </label>
              </>
            )}
            <label className="upload-btn small-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add Files
              <input type="file" multiple accept="application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            {pages.length > 0 && (
              <button className="action-btn export-btn" onClick={exportPDF} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Export Final PDF'}
              </button>
            )}
          </div>
        </header>

        {pages.length === 0 && !isProcessing ? (
          <div className="empty-studio">
            <div className="drop-zone studio-drop">
              <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <h3>Start your Workspace</h3>
              <p>Upload PDF files to start organizing, merging, and splitting pages.</p>
              <label className="upload-btn">
                Browse PDF Files
                <input type="file" multiple accept="application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        ) : (
          <>
            <div className="bulk-toolbar">
               <span>{pages.length} Pages Loaded</span>
               <div className="bulk-actions">
                 <button onClick={rotateAll} className="bulk-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    Rotate All
                 </button>
                 <button onClick={clearAll} className="bulk-btn text-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Clear All
                 </button>
               </div>
            </div>

            <div className="pages-grid">
              {pages.map((page, index) => (
                <div 
                  key={page.id} 
                  className="page-card"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="page-card-header" style={{ borderBottomColor: page.fileColor }}>
                    <span className="file-badge" style={{ backgroundColor: `${page.fileColor}20`, color: page.fileColor }}>
                        {page.filename}
                    </span>
                  </div>
                  
                  <div className="page-content">
                    {/* تدوير الأيقونة بصرياً بناءً على حالة الصفحة */}
                    <svg 
                      className="page-placeholder" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke={page.fileColor} 
                      strokeWidth="1.5"
                      style={{ transform: `rotate(${page.rotation}deg)`, transition: 'transform 0.3s ease' }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <h4>Page {page.originalPageNumber}</h4>
                    {page.rotation !== 0 && <span className="rotation-badge">{page.rotation}°</span>}
                  </div>

                  <div className="page-actions">
                    <button onClick={() => moveUp(index)} disabled={index === 0} title="Move Left/Up">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button onClick={() => moveDown(index)} disabled={index === pages.length - 1} title="Move Right/Down">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <button onClick={() => rotatePage(index)} className="rotate-btn" title="Rotate 90°">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                    <button onClick={() => removePage(index)} className="delete-page-btn" title="Delete Page">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App