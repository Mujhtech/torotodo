$(document).ready(function() {
      // --- Storage & State ------------------------------------------------------
      const LS_KEY = "todos.v1";
      const THEME_KEY = "theme.v1";
      const state = {
        filter: "all",
        todos: load()
      };
      const theme = {
        current: loadTheme()
      };

      // --- Theme Functions -----------------------------------------------------
      function loadTheme() {
        return localStorage.getItem(THEME_KEY) || "dark";
      }

      function saveTheme() {
        localStorage.setItem(THEME_KEY, theme.current);
      }

      function renderTheme() {
        $("html").attr("data-theme", theme.current);

        const icon = theme.current === "dark" ? "☀️" : "🌙";
        $("#theme-switcher").text(icon);
      }

      // --- Utility Functions ---------------------------------------------------
      function uid() {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
      }

      function load() {
        try {
          const raw = localStorage.getItem(LS_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      }

      function save() {
        localStorage.setItem(LS_KEY, JSON.stringify(state.todos));
        updateStorageInfo();
      }

      function updateStorageInfo() {
        const bytes = new Blob([localStorage.getItem(LS_KEY) || ""]).size;
        const kb = (bytes / 1024).toFixed(1);
        $("#storage").text(`${kb} KB used`);
      }

      // --- CRUD Operations -----------------------------------------------------
      function addTodo(title) {
        title = (title || "").trim();
        if (!title) return;

        state.todos.push({
          id: uid(),
          title,
          completed: false,
          createdAt: Date.now()
        });
        save();
        render();
      }

      function toggleTodo(id) {
        const $li = $(`[data-id="${id}"]`);
        if ($li.hasClass('editing')) return;

        const todo = state.todos.find(t => t.id === id);
        if (todo) {
          todo.completed = !todo.completed;
          save();
          render();
        }
      }

      function deleteTodo(id) {
        state.todos = state.todos.filter(t => t.id !== id);
        save();
        render();
      }

      function updateTodo(id, title) {
        const todo = state.todos.find(t => t.id === id);
        if (todo) {
          todo.title = title.trim();
          save();
          render();
        }
      }

      function clearCompleted() {
        state.todos = state.todos.filter(t => !t.completed);
        save();
        render();
      }

      // --- Rendering -----------------------------------------------------------
      function getFiltered() {
        switch (state.filter) {
          case "active": return state.todos.filter(t => !t.completed);
          case "completed": return state.todos.filter(t => t.completed);
          default: return state.todos;
        }
      }

      function createTodoItem(todo) {
        const $li = $(`
          <li class="flex items-center gap-3 py-4 border-b border-border transition-all duration-200 hover:bg-accent/5 hover:rounded-lg hover:mx-[-8px] hover:px-2 ${todo.completed ? 'opacity-75' : ''}" data-id="${todo.id}">
            <label class="flex-1 flex items-center gap-3 cursor-pointer">
              <input type="checkbox" class="w-5 h-5 accent-accent cursor-pointer" ${todo.completed ? 'checked' : ''}>
              <span class="flex-1 text-base leading-relaxed ${todo.completed ? 'text-muted line-through' : 'text-text'}">${todo.title}</span>
            </label>
            <button class="w-6 h-6 md:w-6 md:h-6 w-7 h-7 rounded-full bg-transparent text-muted border border-transparent flex items-center justify-center text-base md:text-base text-lg opacity-60 md:opacity-60 opacity-50 transition-all duration-200 hover:bg-danger/10 hover:text-danger hover:border-danger hover:opacity-100 hover:scale-110 md:hover:scale-110 hover:scale-115" title="Delete task">×</button>
          </li>
        `);

        // Event handlers
        $li.find('input[type="checkbox"]').on('change', () => toggleTodo(todo.id));
        $li.find('button').on('click', () => deleteTodo(todo.id));

        // Inline editing
        $li.on('dblclick', function() {
          const $li = $(this);
          if ($li.hasClass('editing')) return;

          $li.addClass('editing');
          const $span = $li.find('span');
          const $input = $(`<input type="text" class="flex-1 px-3 py-2 rounded-lg border border-accent bg-slate-900/90 text-text text-base" value="${todo.title}">`);

          $span.hide();
          $span.after($input);
          $input.focus().select();

          const commit = () => {
            const val = $input.val().trim();
            if (val) {
              updateTodo(todo.id, val);
            } else {
              deleteTodo(todo.id);
            }
            $li.removeClass('editing');
          };

          const cancel = () => {
            $input.remove();
            $span.show();
            $li.removeClass('editing');
          };

          $input.on('keydown', function(e) {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }).on('blur', commit);
        });

        return $li;
      }

      function render() {
        const $list = $("#list");
        $list.empty();

        getFiltered().forEach(todo => {
          $list.append(createTodoItem(todo));
        });

        $("#count").text(state.todos.length);

        // Update filter pills
        $(".pill[role='tab']").each(function() {
          const $pill = $(this);
          const isActive = $pill.data('filter') === state.filter;

          $pill.removeClass('active')
               .attr('aria-selected', isActive);

          if (isActive) {
            $pill.addClass('active px-4 py-2 rounded-full border border-accent text-accent bg-accent/15 cursor-pointer text-sm font-medium transition-all duration-200');
          } else {
            $pill.addClass('px-4 py-2 rounded-full border border-border-light cursor-pointer text-muted text-sm font-medium transition-all duration-200 hover:bg-accent/10 hover:border-accent hover:text-accent');
          }
        });
      }

      // --- Import/Export --------------------------------------------------------
      function exportJSON() {
        const blob = new Blob([JSON.stringify(state.todos, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const $a = $('<a>').attr({ href: url, download: "todos.json" });
        $('body').append($a);
        $a[0].click();
        $a.remove();
        URL.revokeObjectURL(url);
      }

      function exportCSV() {
        const headers = ["id", "title", "completed", "createdAt", "dueAt"];
        const BOM = "\uFEFF";
        let csv = BOM + headers.join(",") + "\\n";

        const escape = (val) => {
          val = String(val ?? "");
          if (/[",\\n]/.test(val)) {
            val = '"' + val.replace(/"/g, '""') + '"';
          }
          return val;
        };

        state.todos.forEach(todo => {
          const row = [
            escape(todo.id),
            escape(todo.title),
            escape(todo.completed),
            escape(todo.createdAt),
            escape(todo.dueAt)
          ].join(",");
          csv += row + "\\n";
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const $a = $('<a>').attr({ href: url, download: "todos.csv" });
        $('body').append($a);
        $a[0].click();
        $a.remove();
        URL.revokeObjectURL(url);
      }

      function importJSON(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const arr = JSON.parse(e.target.result);
            if (!Array.isArray(arr)) throw new Error("Invalid JSON format");

            // Normalize imported data
            state.todos = arr.map(t => ({
              id: t.id || uid(),
              title: String(t.title || "").trim(),
              completed: !!t.completed,
              createdAt: Number(t.createdAt || Date.now())
            })).filter(t => t.title);

            save();
            render();
          } catch (err) {
            alert("Import failed: " + err.message);
          }
        };
        reader.readAsText(file);
      }

      // --- Event Handlers ------------------------------------------------------
      $("#addBtn").on('click', function() {
        const title = $("#newTodo").val();
        addTodo(title);
        $("#newTodo").val('').focus();
      });

      $("#newTodo").on('keydown', function(e) {
        if (e.key === 'Enter') {
          const title = $(this).val();
          addTodo(title);
          $(this).val('');
        }
      });

      $(".pill").on('click', function() {
        const $pill = $(this);
        const filter = $pill.data('filter');
        const action = $pill.data('action');

        if (filter) {
          state.filter = filter;
          render();
        } else if (action === 'clearCompleted') {
          clearCompleted();
        }
      });

      $("#exportBtn").on('click', exportJSON);
      $("#exportCsvBtn").on('click', exportCSV);

      $("#importBtn").on('click', function() {
        $("#fileInput").click();
      });

      $("#fileInput").on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          importJSON(file);
          $(this).val(''); // Reset file input
        }
      });

      $("#theme-switcher").on('click', function() {
        theme.current = theme.current === "dark" ? "light" : "dark";
        saveTheme();
        renderTheme();
      });

      // --- Bootstrap ------------------------------------------------------------
      // Only seed initial data for first-time users (when localStorage has never been initialized)
      const hasBeenInitialized = localStorage.getItem(LS_KEY) !== null;
      if (state.todos.length === 0 && !hasBeenInitialized) {
        // Seed initial data for workshop
        state.todos = [
          {
            id: uid(),
            title: "Explore the app",
            completed: true,
            createdAt: Date.now() - 86400000
          },
          {
            id: uid(),
            title: "Post a Tweet about #GoogleCloudRoadshow",
            completed: false,
            createdAt: Date.now()
          },
          {
            id: uid(),
            title: "Call Uncle Bob",
            completed: false,
            createdAt: Date.now()
          }
        ];
        save();
      }

      updateStorageInfo();
      render();
      renderTheme();
    });
