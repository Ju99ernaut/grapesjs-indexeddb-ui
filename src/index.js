import domtoimage from 'dom-to-image';

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
            addOnUpgrade: 0,

            // Default page id
            defaultPage: 'Default',

            // Default template id
            defaultTemplate: 'Blank',

            // blank Template
            blankTemplate: {
                id: 'Blank',
                template: true,
                'gjs-html': '',
                'gjs-css': '',
            },

            // When template or page is deleted
            onDelete: res => console.log('Deleted:', res),

            // When error onDelete
            onDeleteError: err => console.log(err),

            // On screenshot error
            onScreenshotError: err => console.log(err),

            // Quality of screenshot image from 0 to 1, more quality increases the image size
            quality: .005,

            // Content for templates modal title
            templatesMdlTitle: '<div style="font-size: 1rem">Create Page</div>',

            // Content for pages modal title
            pagesMdlTitle: '<div style="font-size: 1rem">Select Page</div>',

            // Element shown during loading
            loaderEl: '<div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div>'
        },
        ...opts
    };

    let db;
    let idx = 0; //?Keep track of open page
    let id = options.defaultPage || "Default"; //?Keep track of open page
    let page = ""; //?Keep track of page names
    let templateIdx = 0;
    let template = false; //*Keep track on whether to save as template
    let thumbnail = ''; // Image from screenshot
    const $ = editor.$;
    const pfx = editor.getConfig().stylePrefix
    const cm = editor.Commands;
    const mdl = editor.Modal;
    const sm = editor.StorageManager;
    const storageName = 'indexeddb';
    const objsName = options.objectStoreName;

    const getId = () => sm.getConfig().id || 'gjs-';
    const getCurrentId = () => id;
    const getCurrentIdx = () => idx;

    //some magic from gist.github.com/jed/982883
    const uuidv4 = () => ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );

    const getJpeg = (node, opts = {}, clb, clbErr) => {
        domtoimage.toJpeg(node, opts)
            .then(dataUrl => clb && clb(dataUrl))
            .catch(err => clbErr && clbErr(err))
    };

    editor.domtoimage = domtoimage;

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
                const objs = e.currentTarget.result.createObjectStore(objsName, { keyPath: 'idx' });
                objs.createIndex('id', 'id', { unique: false });
                options.addOnUpgrade && options.addOnUpgrade.forEach(t => {
                    getAsyncObjectStore(objs => {
                        const request = objs.put({
                            idx: uuidv4(),
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
                const request = objs.get(idx);
                request.onerror = clbErr;
                request.onsuccess = () => {
                    const {
                        idx,
                        id,
                        template,
                        ...data
                    } = request.result || {};
                    clb(request.result);
                };
            });
        },

        loadAll(clb, clbErr) {
            getAsyncObjectStore(objs => {
                const request = objs.getAll();
                request.onerror = clbErr;
                request.onsuccess = () => {
                    clb(request.result);
                };
            });
        },

        store(data, clb, clbErr) {
            getAsyncObjectStore(objs => {
                const request = objs.put({
                    idx,
                    id,
                    template,
                    thumbnail,
                    ...data
                });
                request.onerror = clbErr;
                request.onsuccess = clb;
            });
        },

        delete(clb, clbErr) {
            getAsyncObjectStore(objs => {
                const request = objs.delete(idx);
                request.onerror = clbErr;
                request.onsuccess = clb;
            });
        }

    });


    const thumbs = (idx, thumb) => {
        return `<div class="${pfx}templates-card" data-idx="${idx}">
                ${thumb}
            </div>`;
    };
    const thumbCont = thumbs => {
        return `<div class="${pfx}templates-card-2">
                ${thumbs}
            </div>`;
    };
    const templates = thumbCont => {
        return `<div id="templates" class="${pfx}templates ${pfx}one-bg ${pfx}two-color">
                <div class="${pfx}templates-overlay"></div>
                <div class="${pfx}templates-cont">
                    <div class="${pfx}fonts">
                        <label class="${pfx}field-label" for="page-name">Name</label>
                        <div class="${pfx}field">
                            <input type="text" name="pageName" id="page-name">
                        </div>
                        <span>
                            <button class="${pfx}btn-prim ${pfx}btn-wide" id="template-edit">
                                Edit Selected
                            </button>
                        </span>
                        <span>
                            <button class="${pfx}btn-prim ${pfx}btn-wide" id="page-create">
                                Create
                            </button>
                        </span>
                    </div>
                    <div class="${pfx}templates-header2">
                        Templates
                    </div>
                    ${thumbCont}
                </div>
            </div>`;
    };
    const pages = thumbCont => {
        return `<div id="pages" class="${pfx}templates ${pfx}one-bg ${pfx}two-color">
            <div class="${pfx}templates-overlay"></div>
            <div class="${pfx}templates-cont">
                <div class="${pfx}templates-header2">
                Your Pages
                </div>
                    ${thumbCont}
                </div>
            </div>`;
    };

    const render = (data, templatesRender = true) => {
        let thumbnailsEl = '';
        data.forEach(el => {
            const dataSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="template-preview" viewBox="0 0 1300 1100" width="99%" height="220">
                    <foreignObject width="100%" height="100%" style="pointer-events:none">
                    <div xmlns="http://www.w3.org/1999/xhtml" ${el[getId()+'html'] ? '' : 'padding-top:100%'}">
                    ${el[getId()+'html'] + '<style scoped>' + el[getId()+'css'] + '</style>'}
                    </div>
                    </foreignObject>
                </svg>`;
            let thumbnailEl = el.thumbnail ? `<div class="${pfx}thumbnail-cont">
                    <img class="template-preview" src="${el.thumbnail}" alt="${el.id}">
                </div>` : dataSvg;
            thumbnailEl = `<div class="${pfx}thumb-select" data-idx="${el.idx}">
                    ${thumbnailEl}
                </div>`;
            thumbnailEl += `<div class="label">
                    ${el.id}
                    <div class="${pfx}field" style="display:none;" >
                        <input type="text" placeholder="page name" data-idx="${el.idx}">
                    </div>
                    <i class="${pfx}caret-icon fa fa-i-cursor" title="rename" data-idx="${el.idx}"></i>
                    <i class="${pfx}caret-icon fa fa-trash-o" title="delete" data-idx="${el.idx}"></i>
                </div>`;
            templatesRender ? el.template && (() => thumbnailsEl += thumbs(el.idx, thumbnailEl))() :
                !el.template && (() => thumbnailsEl += thumbs(el.idx, thumbnailEl))();
        });

        return templatesRender ? templates(thumbCont(thumbnailsEl)) : pages(thumbCont(thumbnailsEl))
    };

    cm.add('open-templates', {
        run(editor, sender) {
            const mdlClass = `${pfx}mdl-dialog-tml`;
            const mdlDialog = document.querySelector(`.${pfx}mdl-dialog`);
            mdlDialog.classList.add(mdlClass);
            sender && sender.set && sender.set('active');
            mdl.setTitle(options.templatesMdlTitle);
            mdl.setContent($(options.loaderEl));
            editor.Storage.get('indexeddb').loadAll(res => {
                    mdl.setContent(render(res));
                    $(`.${pfx}templates-card`).each((i, elm) => elm.dataset.idx == templateIdx && elm.classList.add(`${pfx}templates-card-active`));
                    $('#page-name').on('keyup', e => page = e.currentTarget.value)
                    $('#page-create').on('click', e => {
                        idx = templateIdx;
                        template = false;
                        page && editor.load(res => {
                            editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
                            editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
                            thumbnail = res.thumbnail || '';
                            id = page;
                            idx = uuidv4();
                            mdl.close();
                        });
                    });
                    $('#template-edit').on('click', e => {
                        idx = templateIdx;
                        template = true;
                        editor.load(res => {
                            editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
                            editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
                            thumbnail = res.thumbnail || '';
                            mdl.close();
                        });
                    });
                    $(`.${pfx}thumb-select`).on('click', e => {
                        templateIdx = e.currentTarget.dataset.idx;
                        $(`.${pfx}templates-card`).each((i, elm) => elm.classList.remove(`${pfx}templates-card-active`));
                        e.currentTarget.parentElement.classList.add(`${pfx}templates-card-active`);
                    });
                },
                err => console.log("Error", err));
            mdl.open();
            mdl.getModel().once('change:open', () => {
                mdlDialog.classList.remove(mdlClass);
            });
        }
    });

    cm.add('open-pages', {
        run(editor, sender) {
            const mdlClass = `${pfx}mdl-dialog-tml`;
            const mdlDialog = document.querySelector(`.${pfx}mdl-dialog`);
            mdlDialog.classList.add(mdlClass);
            sender && sender.set && sender && sender.set('active');
            mdl.setTitle(options.pagesMdlTitle);
            mdl.setContent($(options.loaderEl));
            editor.Storage.get('indexeddb').loadAll(res => {
                    mdl.setContent(render(res, false));
                    $(`.${pfx}templates-card`).each((i, elm) => elm.dataset.idx == idx && elm.classList.add(`${pfx}templates-card-active`));
                    $(`.${pfx}thumb-select`).on('click', e => {
                        idx = e.currentTarget.dataset.idx;
                        template = false;
                        editor.load(res => {
                            id = res.id;
                            editor.setComponents(res.components ? JSON.parse(res.components) : res.html);
                            editor.setStyle(res.styles ? JSON.parse(res.styles) : res.css);
                            thumbnail = res.thumbnail || '';
                            mdl.close();
                        });
                    });
                },
                err => console.log("Error", err));
            mdl.open();
            mdl.getModel().once('change:open', () => {
                mdlDialog.classList.remove(mdlClass);
            });
        }
    });

    cm.add('save-as-template', editor => {
        template = true;
        editor.store();
    });

    cm.add('delete-from-idb', editor => {
        editor.Storage.get('indexeddb').delete(res => options.onDelete(res), err => options.onDeleteError(err));
        editor.Commands.run('open-pages');
    });

    cm.add('take-screenshot', editor => {
        // take scrrenshot
        const clb = dataUrl => {
            // set to current object
            thumbnail = dataUrl;
            editor.store();
        };
        const clbErr = err => options.onScreenshotError(err);
        const el = editor.getWrapper().getEl();
        getJpeg(el, {
            quality: options.quality,
            height: 1000,
            'cacheBust': true,
            style: {
                'background-color': el.style.backgroundColor || 'white',
            },
        }, clb, clbErr);
    });

    cm.add('get-current-id', editor => getCurrentId());

    cm.add('get-current-idx', editor => getCurrentIdx());

    cm.add('get-uuidv4', () => uuidv4());

    editor.on('storage:load', res => thumbnail = res.thumbnail || '');

    editor.on('load', () => {
        // Create blank template if requested and none exists
        options.blankTemplate && getAsyncObjectStore(objs => {
            const blank = objs.index('id').get(options.blankTemplate.id);
            //request.onerror = clbErr;
            blank.onsuccess = () => {
                !blank.result && objs.put({ idx: uuidv4(), ...options.blankTemplate });
            };
            const def = objs.index('id').get(options.defaultPage);
            def.onsuccess = () => {
                idx = def.result ? def.result.idx : uuidv4();
                editor.load();
            };
            const temp = objs.index('id').get(options.defaultTemplate);
            temp.onsuccess = () => {
                temp.result && (templateIdx = def.result.idx);
            }
        });
    });
};