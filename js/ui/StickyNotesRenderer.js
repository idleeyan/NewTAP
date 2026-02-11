export class StickyNotesRenderer {
  constructor(stickyNoteManager) {
    this.stickyNoteManager = stickyNoteManager;
  }

  render() {
    const grid = document.getElementById('notesGrid');
    if (!grid) return;

    const notes = this.stickyNoteManager.getAllNotes();

    if (notes.length === 0) {
      grid.innerHTML = `
        <div class="empty-notes" style="grid-column: 1 / -1;">
          <div class="empty-notes-icon">📝</div>
          <p>还没有便签</p>
          <p style="font-size: 0.9rem; margin-top: 10px;">点击上方按钮创建第一个便签</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    notes.forEach((note, index) => {
      const card = this.createNoteElement(note, index);
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  createNoteElement(note, index) {
    const card = document.createElement('div');
    card.className = `note-card color-${note.color}`;
    card.dataset.noteId = note.id;
    card.style.animationDelay = `${index * 0.05}s`;

    const date = new Date(note.updatedAt).toLocaleDateString('zh-CN');

    card.innerHTML = `
      <div class="note-header">
        <input type="text" class="note-title-input" placeholder="便签标题" value="${this.escapeHtml(note.title)}">
        <div class="note-actions">
          <button class="note-btn" title="删除" data-action="delete">🗑️</button>
        </div>
      </div>
      <textarea class="note-content" placeholder="在此输入内容...">${this.escapeHtml(note.content)}</textarea>
      <div class="note-footer">
        <span class="note-date">${date}</span>
        <div class="note-colors">
          ${this.stickyNoteManager.getColors().map(color => `
            <div class="color-dot ${color.id} ${note.color === color.id ? 'active' : ''}"
                 data-color="${color.id}" title="${color.name}"></div>
          `).join('')}
        </div>
      </div>
    `;

    const titleInput = card.querySelector('.note-title-input');
    const contentInput = card.querySelector('.note-content');
    const deleteBtn = card.querySelector('[data-action="delete"]');
    const colorDots = card.querySelectorAll('.color-dot');

    let titleTimeout;
    titleInput.addEventListener('input', (e) => {
      clearTimeout(titleTimeout);
      titleTimeout = setTimeout(() => {
        this.stickyNoteManager.updateNote(note.id, { title: e.target.value });
      }, 500);
    });

    let contentTimeout;
    contentInput.addEventListener('input', (e) => {
      clearTimeout(contentTimeout);
      contentTimeout = setTimeout(() => {
        this.stickyNoteManager.updateNote(note.id, { content: e.target.value });
      }, 500);
    });

    deleteBtn.addEventListener('click', async () => {
      if (confirm('确定删除这个便签吗？')) {
        await this.stickyNoteManager.deleteNote(note.id);
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => this.render(), 200);
      }
    });

    colorDots.forEach(dot => {
      dot.addEventListener('click', async () => {
        const color = dot.dataset.color;
        await this.stickyNoteManager.updateNote(note.id, { color });
        card.className = `note-card color-${color}`;
        colorDots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    card.draggable = true;

    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', note.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.note-card.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const draggingCard = document.querySelector('.note-card.dragging');
      if (draggingCard && draggingCard !== card) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = note.id;

      if (draggedId !== targetId) {
        await this.stickyNoteManager.reorderNotes(draggedId, targetId);
        this.render();
      }
    });

    return card;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
