import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'

function App() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // حل مشكلة اختيار نفس الملف ودمج الملفات الجديدة مع القديمة
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setSelectedFiles((prevFiles) => [...prevFiles, ...newFiles])
    }
    // تفريغ المدخل ليسمح باختيار نفس الملف مرة أخرى
    event.target.value = ''
  }

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove))
  }

  // كود الدمج الفعلي الاحترافي
  const mergePDFs = async () => {
    if (selectedFiles.length < 2) {
      alert('Please select at least 2 PDF files to merge.')
      return
    }

    setIsProcessing(true)
    try {
      const mergedPdf = await PDFDocument.create()

      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await PDFDocument.load(arrayBuffer)
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        copiedPages.forEach((page) => mergedPdf.addPage(page))
      }

      const pdfBytes = await mergedPdf.save()
      
      // تحميل الملف المدمج للمستخدم
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Merged_OnePDF_${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // مسح القائمة بعد النجاح
      setSelectedFiles([])
    } catch (error) {
      console.error('Error merging PDFs:', error)
      alert('An error occurred while merging. Please ensure all files are valid PDFs.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="app-container">
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
            <li className="menu-item active">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              Merge PDF
            </li>
            <li className="menu-item disabled">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line></svg>
              Split PDF
              <span className="badge">Soon</span>
            </li>
            <li className="menu-item disabled">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="M12 12v9"></path><path d="m8 17 4 4 4-4"></path></svg>
              Compress
              <span className="badge">Soon</span>
            </li>
          </ul>
        </div>

        <div className="menu-section">
          <p className="section-title">DOCUMENT SECURITY</p>
          <ul className="menu-list">
            <li className="menu-item disabled">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Add Password<span className="badge">Soon</span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="main-workspace">
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
              <input type="file" multiple accept="application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="files-list-container">
              <div className="files-header">
                <h4>Selected Files ({selectedFiles.length})</h4>
                <button className="clear-btn" onClick={() => setSelectedFiles([])}>Clear All</button>
              </div>
              <ul className="files-list">
                {selectedFiles.map((file, index) => (
                  <li key={index} className="file-item">
                    <div className="file-info">
                      <svg className="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      <span>{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(index)} className="remove-btn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </li>
                ))}
              </ul>
              <button 
                className={`action-btn ${isProcessing ? 'processing' : ''}`} 
                onClick={mergePDFs}
                disabled={isProcessing || selectedFiles.length < 2}
              >
                {isProcessing ? 'Merging...' : 'Merge PDFs Now'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App