export default (editor, opts = {}) => {
  const options = {
    ...{
      // Database name
      dbName: 'gjs',

      // Collection name
      objectStoreName: 'templates',

      // Indexeddb version schema
      indexeddbVersion: 4,

      // Load on schema upgrade
      addOnUpgrade: 0

    },
    ...opts
  };

  //todo update for prefix use
  let db;
  let id = "Default"; //?Keep track of open page
  let page = ""; //?Keep track of page names
  let templateName = "Blank";
  let template = false; //*Keep track on whether to save as template
  const $ = document.querySelectorAll.bind(document);
  const cm = editor.Commands;
  const mdl = editor.Modal;
  const sm = editor.StorageManager;
  const storageName = 'indexeddb';
  const objsName = options.objectStoreName;

  const getId = () => sm.getConfig().id || 'gjs-';
  const getCurrentId = () => id;

  // Functions for DB retrieving
  const getDb = () => db;
  const getAsyncDb = (clb) => {
    if (db) {
      clb(db);
    } else {
      const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      const request = indexedDB.open(options.dbName, options.indexeddbVersion);
      const onError = () => sm.onError(storageName, request.errorCode);
      request.onerror = onError;
      request.onsuccess = () => {
        db = request.result;
        db.onerror = onError;
        clb(db);
      };
      request.onupgradeneeded = e => {
        e.currentTarget.result.createObjectStore(objsName, {
          keyPath: 'id',
        });
        options.addOnUpgrade && options.addOnUpgrade.forEach(t => {
          getAsyncObjectStore(objs => {
            const request = objs.put({
              id: t.id,
              template: t.template,
              ...t
            });
          });
        })
        //fetch('./templates.json')
        //  .then(res => {
        //    return res.json();
        //  })
        //  .then(res => res.templates.forEach(t => {
        //    getAsyncObjectStore(objs => {
        //      const request = objs.put({
        //        id: t.id,
        //        template: t.template,
        //        ...t
        //      });
        //    });
        //  }))
      };
    }
  };

  // Functions for object store retrieving
  const getObjectStore = () => {
    return db.transaction([objsName], 'readwrite').objectStore(objsName);
  };
  const getAsyncObjectStore = clb => {
    if (db) {
      clb(getObjectStore());
    } else {
      getAsyncDb(db => clb(getObjectStore()))
    }
  };

  // Add custom storage to the editor
  sm.add(storageName, {
    getDb,

    getObjectStore,

    load(keys, clb, clbErr) {
      getAsyncObjectStore(objs => {
        const request = objs.get(id);
        request.onerror = clbErr;
        request.onsuccess = () => {
          const {
            id,
            template,
            ...data
          } = request.result || {};
          clb(data);
        };
      });
    },

    loadAll(clb, clbErr) {
      getAsyncObjectStore(objs => {
        const request = objs.getAll();
        request.onerror = clbErr;
        request.onsuccess = () => {
          //const {
          //  id,
          //  ...data
          //} = request.result || {};
          clb(request.result);
        };
      });
    },

    store(data, clb, clbErr) {
      getAsyncObjectStore(objs => {
        const request = objs.put({
          id: id,
          template: template,
          ...data
        });
        request.onerror = clbErr;
        request.onsuccess = clb;
      });
    },

    delete(clb, clbErr) {
      getAsyncObjectStore(objs => {
        const request = objs.delete(id);
        request.onerror = clbErr;
        request.onsuccess = clb;
      });
    }

  });


  const thumbs = (id, thumb) => {
    return `<div class="gjs-templates-card" data-id="${id}">
      ${thumb}
    </div>`;
  };
  const thumbCont = thumbs => {
    return `<div class="gjs-templates-card-2">
      ${thumbs}
    </div>`;
  };
  const templates = thumbCont => {
    return `<div id="templates" class="gjs-templates gjs-one-bg gjs-two-color">
      <div class="gjs-templates-overlay"></div>
      <div class="gjs-templates-cont">
        <div class="gjs-fonts">
          <label style="font-size: 0.9rem;font-family: Arial, Helvetica, sans-serif; display: block;" for="page-name">Name</label>
          <div style="width: 50%; display: inline-block;" class="gjs-field">
            <input style="border: 1px solid rgba(0, 0, 0, 0.2);
              border-radius: 5px;
              font-family: Arial, Helvetica, sans-serif;" type="text" name="pageName" id="page-name">
          </div>
          <span style="display: inline-block;">
            <button class="gjs-btn-prim" style="padding: 10px;
            border-radius: 3px;
            font-size: 0.9rem;
            margin-left: 220px;" id="template-edit">Edit Selected</button>
          </span>
          <span style="display: inline-block;">
            <button class="gjs-btn-prim" style="padding: 10px;
              border-radius: 3px;
              font-size: 0.9rem;
              margin-left: 10px;" id="page-create">Create</button>
          </span>
        </div>
        <div class="gjs-templates-header2">
          Templates
        </div>
        ${thumbCont}
      </div>
    </div>`;
  };
  const pages = thumbCont => {
    return `<div id="pages" class="gjs-templates gjs-one-bg gjs-two-color">
    <div class="gjs-templates-overlay"></div>
    <div class="gjs-templates-cont">
      <div class="gjs-templates-header2">
        Your Pages
      </div>
      ${thumbCont}
      </div>
    </div>`;
  };

  const render = (data, templatesRender = true) => {
    let thumbnails = '';
    data.forEach(el => {
      let dataSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="template-preview" viewBox="0 0 1300 1100" width="99%" height="220">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" ${el[getId()+'html'] ? '' : 'padding-top:100%'}">
          ${el[getId()+'html'] + '<style>' + el[getId()+'css'] + '</style>'}
          </div>
        </foreignObject>
      </svg>`;
      let thumbnail = `${dataSvg}
      <div>${el.id}</div>`;
      templatesRender ? el.template && (() => thumbnails += thumbs(el.id, thumbnail))() :
        !el.template && (() => thumbnails += thumbs(el.id, thumbnail))();
    });
    return templatesRender ? templates(thumbCont(thumbnails)) : pages(thumbCont(thumbnails))
  };

  cm.add('open-templates', {
    run(editor, sender) {
      const mdlClass = 'gjs-mdl-dialog-tml';
      const mdlDialog = document.querySelector('.gjs-mdl-dialog');
      mdlDialog.classList.add(mdlClass);
      sender && sender.set && sender.set('active');
      mdl.setTitle('<div style="font-size: 1rem">Create Page</div>');
      editor.Storage.get('indexeddb').loadAll(res => {
          mdl.setContent(render(res));
          $('.gjs-templates-card').forEach(elm => elm.dataset.id == templateName && elm.classList.add('gjs-templates-card-active'));
          $('#page-name')[0].addEventListener('keyup', e => page = e.currentTarget.value)
          $('#page-create')[0].addEventListener('click', e => {
            id = templateName;
            template = false;
            page && editor.load(res => {
              editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
              editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
              id = page;
              mdl.close();
            });
          });
          $('#template-edit')[0].addEventListener('click', e => {
            id = templateName;
            template = true;
            editor.load(res => {
              editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
              editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
              mdl.close();
            });
          });
          $('.gjs-templates-card').forEach(el => {
            el.addEventListener('click', e => {
              templateName = e.currentTarget.dataset.id;
              $('.gjs-templates-card').forEach(elm => elm.classList.remove('gjs-templates-card-active'));
              el.classList.add('gjs-templates-card-active');
            });
          });
        },
        err => console.log("Error", err));
      mdl.open();
      mdl.getModel().once('change:open', () => {
        document.querySelector('.gjs-mdl-collector').innerHTML = "";
        mdlDialog.classList.remove(mdlClass);
      });
    }
  });
  cm.add('open-pages', {
    run(editor, sender) {
      const mdlClass = 'gjs-mdl-dialog-tml';
      const mdlDialog = document.querySelector('.gjs-mdl-dialog');
      mdlDialog.classList.add(mdlClass);
      sender && sender.set && sender && sender.set('active');
      mdl.setTitle('<div style="font-size: 1rem">Select Page</div>');
      editor.Storage.get('indexeddb').loadAll(res => {
          mdl.setContent(render(res, false));
          $('.gjs-templates-card').forEach(elm => elm.dataset.id == id && elm.classList.add('gjs-templates-card-active'));
          $('.gjs-templates-card').forEach(el => {
            el.addEventListener('click', e => {
              id = e.currentTarget.dataset.id;
              template = false;
              editor.load(res => {
                editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
                editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
                mdl.close();
              });
            })
          });
        },
        err => console.log("Error", err));
      mdl.open();
      mdl.getModel().once('change:open', () => {
        document.querySelector('.gjs-mdl-collector').innerHTML = "";
        mdlDialog.classList.remove(mdlClass);
      });
    }
  });

  cm.add('save-as-template', {
    run(editor, sender) {
      template = true;
      editor.store();
    }
  });

  cm.add('delete-from-idb', {
    run(editor, sender) {
      editor.Storage.get('indexeddb').delete(res => console.log(res), err => console.log(err));
      editor.Commands.run('open-pages');
    }
  });
};