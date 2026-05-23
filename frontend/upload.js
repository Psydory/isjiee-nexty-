/* Upload widget */
.upload-dropzone {
  transition: all 0.2s ease;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;
  cursor: pointer;
}
.upload-dropzone.drag-over {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.1);
}
.upload-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}
.upload-preview-item {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-card-alt);
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-preview-item img,
.upload-preview-item video {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}
.upload-preview-item button {
  position: absolute;
  top: 0;
  right: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0,0,0,0.7);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 12px;
}
.upload-progress {
  margin-top: 1rem;
}
.progress-bar-container {
  background: var(--border-color);
  border-radius: var(--radius-full);
  height: 10px;
  overflow: hidden;
}
.progress-fill {
  background: var(--color-primary);
  width: 0%;
  height: 100%;
  transition: width 0.3s ease;
}
.progress-text {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
}