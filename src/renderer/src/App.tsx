import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'

function App() {
  // للتبديل بين الخصائص
  const [activeTab, setActiveTab] = useState<'merge' | 'split'>('merge')
  const [isProcessing, setIsProcessing] = useState(false)

  // --- حالات خاصة بدمج الملفات (Merge) ---
  const [mergeFiles, setMergeFiles] = useState<File[]>([])

  const handleMergeFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setMergeFiles((prev) => [...prev, ...newFiles])
    }
    event.target.value = ''
  }

  const removeMergeFile = (indexToRemove: number) => {
    setMergeFiles((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  const handleMerge = async () => {
    if (mergeFiles.length < 2) return
    setIsProcessing(true)
    try {
      const mergedPdf = await PDFDocument.create()
      for (const file of mergeFiles) {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }
      const pdfBytes = await mergedPdf.save()
      downloadPDF(pdfBytes, `Merged_${Date.now()}.pdf`)
      setMergeFiles([])
    } catch (error) {
      alert('Error merging PDFs.')
    } finally {
      setIsProcessing(false)
    }
  }

  // --- حالات خاصة بتقسيم الملفات (Split) ---
  const [splitFile, setSplitFile] = useState<File | null>(null)
  const [startPage, setStartPage] = useState<string>('1')
  const [endPage, setEndPage] = useState<string>('')

  const handleSplitFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSplitFile(event.target.files[0])
      setStartPage('1')
      setEndPage('') // سنتركها فارغة مبدئياً
    }
    event.target.value = ''
  }

  const handleSplit = async () => {
    if (!splitFile) return
    setIsProcessing(true)
    try {
      const arrayBuffer = await splitFile.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const totalPages = pdfDoc.getPageCount()

      let start = parseInt(startPage) || 1
      let end = parseInt(endPage) || totalPages

      // تأمين المدخلات
      if (start < 1) start = 1
      if (end > totalPages) end = totalPages
      if (start > end) {
        alert('Start page cannot be greater than end page.')
        setIsProcessing(false)
        return
      }

      const newPdf = await PDFDocument.create()
      // pdf-lib يبدأ الفهرسة من 0
      const pageIndices = Array.from({ length: end - start + 1 }, (_, i) => (start - 1) + i)
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices)
      copiedPages.forEach((page) => newPdf.addPage(page))

      const pdfBytes = await newPdf.save()
      downloadPDF(pdfBytes, `Split_${start}_to_${end}_${Date.now()}.pdf`)
      
      setSplitFile(null)
    } catch (error) {
      alert('Error splitting PDF.')
    } finally {
      setIsProcessing(false)
    }
  }

  // دالة مساعدة للتحميل
  const downloadPDF = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-container">
      {/* القائمة الجانبية */}
      <aside className="sidebar">
        <div className="logo-area">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <h2>OnePDF <span>Vault</span></h2>
        </div>

        <div className="menu-section">
          <p className="section-title">RECOMMENDED</p>
          <ul className="menu-list">
            <li 
              className={`menu-item ${activeTab === 'merge' ? 'active' : ''}`}
              onClick={() => setActiveTab('merge')}
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Merge PDF
            </li>
            <li 
              className={`menu-item ${activeTab === 'split' ? 'active' : ''}`}
              onClick={() => setActiveTab('split')}
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
              Split PDF
            </li>
            <li className="menu-item disabled">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg>
              Compress
              <span className="badge">Soon</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* مساحة العمل الرئيسية */}
      <main className="main-workspace">
        
        {/* --- واجهة دمج الملفات --- */}
        {activeTab === 'merge' && (
          <>
            <header className="workspace-header">
              <h1>Merge PDF Files</h1>
              <p>Combine multiple PDFs into a single document securely, entirely offline.</p>
            </header>
            <div className="upload-container">
              <div className="drop-zone">
                <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <h3>Select PDF files</h3>
                <p>Upload your files to combine them into one</p>
                <label className="upload-btn">
                  Browse Files
                  <input type="file" multiple accept="application/pdf" onChange={handleMergeFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              {mergeFiles.length > 0 && (
                <div className="files-list-container">
                  <div className="files-header">
                    <h4>Selected Files ({mergeFiles.length})</h4>
                    <button className="clear-btn" onClick={() => setMergeFiles([])}>Clear All</button>
                  </div>
                  <ul className="files-list">
                    {mergeFiles.map((file, index) => (
                      <li key={index} className="file-item">
                        <div className="file-info">
                          <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                          <span>{file.name}</span>
                        </div>
                        <button onClick={() => removeMergeFile(index)} className="remove-btn">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button className={`action-btn ${isProcessing ? 'processing' : ''}`} onClick={handleMerge} disabled={isProcessing || mergeFiles.length < 2}>
                    {isProcessing ? 'Merging...' : 'Merge PDFs Now'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* --- واجهة تقسيم الملفات --- */}
        {activeTab === 'split' && (
          <>
            <header className="workspace-header">
              <h1>Split PDF File</h1>
              <p>Extract specific pages from your PDF document easily and securely.</p>
            </header>
            <div className="upload-container">
              {!splitFile ? (
                <div className="drop-zone">
                  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line></svg>
                  <h3>Select a PDF file</h3>
                  <p>Upload the file you want to split or extract pages from</p>
                  <label className="upload-btn">
                    Browse File
                    <input type="file" accept="application/pdf" onChange={handleSplitFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              ) : (
                <div className="files-list-container split-config">
                  <div className="files-header">
                    <h4>Selected Document</h4>
                    <button className="clear-btn" onClick={() => setSplitFile(null)}>Change File</button>
                  </div>
                  
                  <div className="file-item split-file-preview">
                    <div className="file-info">
                       <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
                       <span>{splitFile.name}</span>
                    </div>
                  </div>

                  <div className="page-range-selector">
                    <label>Extract Pages:</label>
                    <div className="range-inputs">
                      <div className="input-group">
                        <span>From</span>
                        <input type="number" min="1" value={startPage} onChange={(e) => setStartPage(e.target.value)} placeholder="1" />
                      </div>
                      <div className="input-group">
                        <span>To</span>
                        <input type="number" min="1" value={endPage} onChange={(e) => setEndPage(e.target.value)} placeholder="End" />
                      </div>
                    </div>
                  </div>

                  <button className={`action-btn split-btn ${isProcessing ? 'processing' : ''}`} onClick={handleSplit} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Extract Pages Now'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App