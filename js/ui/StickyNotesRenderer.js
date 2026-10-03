export class StickyNotesRenderer {
  constructor(stickyNoteManager) {
    this.stickyNoteManager = stickyNoteManager;
    this._timeouts = new Map();
    this._gridClickAttached = false;
    this._modalOverlay = null;
    this._activeNoteId = null;
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
      // grid（#notesGrid）为持久元素，监听一次委托绑定即可；此处不重置标志，
      // 否则删光便签再创建后 _attachGridListeners 会重复绑定（删除弹两次确认框等）
      return;
    }

    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    notes.forEach((note, index) => {
      const card = this.createNoteElement(note, index);
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);

    if (!this._gridClickAttached) {
      this._gridClickAttached = true;
      this._attachGridListeners(grid);
    }
  }

  createNoteElement(note, index) {
    const card = document.createElement('div');
    card.className = `note-card color-${note.color}`;
    card.dataset.noteId = note.id;
    card.style.animationDelay = `${Math.min(index, 15) * 0.05}s`;
    card.draggable = true;

    const date = new Date(note.updatedAt).toLocaleDateString('zh-CN');
    const colors = this.stickyNoteManager.getColors();

    card.innerHTML = `
      <textarea class="note-content" placeholder="在此输入内容...">${this.escapeHtml(note.content)}</textarea>
      <div class="note-footer">
        <button class="note-delete-btn" title="删除" data-action="delete">🗑️</button>
        <span class="note-date">${date}</span>
        <div class="note-colors">
          ${colors.map(color => `
            <div class="color-dot ${color.id} ${note.color === color.id ? 'active' : ''}"
                 data-color="${color.id}" title="${color.name}"></div>
          `).join('')}
        </div>
      </div>
    `;

    return card;
  }

  _attachGridListeners(grid) {
    grid.addEventListener('input', (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;

      const noteId = card.dataset.noteId;
      const target = e.target;

      if (target.classList.contains('note-content')) {
        this._debounceUpdate(noteId, 'content', target.value);
      }
    });

    grid.addEventListener('click', async (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;

      const noteId = card.dataset.noteId;

      if (e.target.classList.contains('note-delete-btn') && e.target.dataset.action === 'delete') {
        if (confirm('确定删除这个便签吗？')) {
          await this.stickyNoteManager.deleteNote(noteId);
          card.style.transform = 'scale(0.8)';
          card.style.opacity = '0';
          setTimeout(() => this.render(), 200);
        }
        return;
      }

      const dot = e.target.closest('.color-dot');
      if (dot) {
        const color = dot.dataset.color;
        await this.stickyNoteManager.updateNote(noteId, { color });
        card.className = `note-card color-${color}`;
        card.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        return;
      }

      // 点击卡片内容区域（非删除按钮、非颜色点）打开模态框
      if (e.target.closest('.note-content') || e.target.classList.contains('note-card')) {
        this._openModal(card, noteId);
      }
    });

    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.noteId);
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', (e) => {
      const card = e.target.closest('.note-card');
      if (card) card.classList.remove('dragging');
      grid.querySelectorAll('.note-card.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const card = e.target.closest('.note-card');
      if (!card) return;
      const draggingCard = grid.querySelector('.note-card.dragging');
      if (draggingCard && draggingCard !== card) {
        card.classList.add('drag-over');
      }
    });

    grid.addEventListener('dragleave', (e) => {
      const card = e.target.closest('.note-card');
      if (card) card.classList.remove('drag-over');
    });

    grid.addEventListener('drop', async (e) => {
      e.preventDefault();
      const card = e.target.closest('.note-card');
      if (!card) return;
      card.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain');
      const targetId = card.dataset.noteId;

      if (draggedId && draggedId !== targetId) {
        await this.stickyNoteManager.reorderNotes(draggedId, targetId);
        this.render();
      }
    });
  }

  _getOrCreateModal() {
    if (this._modalOverlay) return this._modalOverlay;

    const overlay = document.createElement('div');
    overlay.className = 'note-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'note-modal';

    const header = document.createElement('div');
    header.className = 'note-modal-header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'note-modal-close';
    closeBtn.innerHTML = '&times;';
    header.appendChild(closeBtn);

    const content = document.createElement('textarea');
    content.className = 'note-modal-content';
    content.placeholder = '在此输入内容...';

    const footer = document.createElement('div');
    footer.className = 'note-modal-footer';
    const dateSpan = document.createElement('span');
    dateSpan.className = 'note-modal-date';
    footer.appendChild(dateSpan);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._closeModal();
      }
    });

    // 关闭按钮
    closeBtn.addEventListener('click', () => {
      this._closeModal();
    });

    // 模态框内容编辑同步
    content.addEventListener('input', () => {
      if (this._activeNoteId) {
        this._debounceUpdate(this._activeNoteId, 'content', content.value);
      }
    });

    // === 阻止滚动穿透，但保留文本选中/光标功能 ===

    const blockScroll = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    overlay.addEventListener('wheel', blockScroll, { passive: false, capture: true });
    overlay.addEventListener('touchmove', blockScroll, { passive: false, capture: true });

    modal.addEventListener('wheel', blockScroll, { passive: false, capture: true });
    modal.addEventListener('touchmove', blockScroll, { passive: false, capture: true });

    // textarea 内容区：正常滚动，到达边界时阻止传播
    content.addEventListener('wheel', (e) => {
      const { scrollTop, scrollHeight, clientHeight } = content;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        e.preventDefault();
        e.stopPropagation();
      }
      e.stopPropagation();
    }, { passive: false });

    document.body.appendChild(overlay);
    this._modalOverlay = overlay;
    return overlay;
  }

  _openModal(card, noteId) {
    const note = this.stickyNoteManager.getAllNotes().find(n => n.id === noteId);
    if (!note) return;

    const overlay = this._getOrCreateModal();
    const modal = overlay.querySelector('.note-modal');
    const content = overlay.querySelector('.note-modal-content');
    const dateSpan = overlay.querySelector('.note-modal-date');

    // 设置颜色
    modal.className = `note-modal color-${note.color}`;

    // 填充内容
    content.value = note.content;
    const date = new Date(note.updatedAt).toLocaleDateString('zh-CN');
    dateSpan.textContent = date;

    this._activeNoteId = noteId;
    overlay.style.display = 'flex';
    overlay.classList.remove('closing');

    // 锁定整个页面：阻止底层所有滚动和交互
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    const notesPage = document.querySelector('.notes-page');
    if (notesPage) {
      notesPage.style.pointerEvents = 'none';
    }

    // 聚焦并移动光标到末尾
    requestAnimationFrame(() => {
      content.focus();
      content.setSelectionRange(content.value.length, content.value.length);
    });
  }

  _closeModal() {
    if (!this._modalOverlay) return;

    const overlay = this._modalOverlay;
    const content = overlay.querySelector('.note-modal-content');

    // 同步内容回卡片
    if (this._activeNoteId) {
      const card = document.querySelector(`.note-card[data-note-id="${this._activeNoteId}"]`);
      if (card) {
        const cardTextarea = card.querySelector('.note-content');
        if (cardTextarea) {
          cardTextarea.value = content.value;
        }
      }
      this._activeNoteId = null;
    }

    // 恢复底层交互
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    const notesPage = document.querySelector('.notes-page');
    if (notesPage) {
      notesPage.style.pointerEvents = '';
    }

    overlay.classList.add('closing');
    const onAnimEnd = () => {
      overlay.style.display = 'none';
      overlay.removeEventListener('animationend', onAnimEnd);
    };
    overlay.addEventListener('animationend', onAnimEnd);
  }

  _debounceUpdate(noteId, field, value) {
    const key = `${noteId}-${field}`;
    const existing = this._timeouts.get(key);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      this.stickyNoteManager.updateNote(noteId, { [field]: value });
      this._timeouts.delete(key);
    }, 500);

    this._timeouts.set(key, timeout);
  }

  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
