const fs = require("fs-extra");
const mimetypes = require("mime-types");

const E = require("./thumb-errors.js");

const ThumbSize = Object.freeze({
    MEDIUM: {
        name: '240p',
        width: 240,
        height: 240
    },

    LARGE: {
        name: '480p',
        width: 480,
        height: 480
    }
});

const _defaultOptions = {
    forceCreate: false,
    size: ThumbSize.LARGE
};

let _thumbSuppliers = new Map();
const _registerThumbSupplier = (mimetype, ThumbSupplier) => {
    _thumbSuppliers.set(mimetype, ThumbSupplier);
}

const _fetchThumbnailSupplier = (file, options) => {
    const mime = options.mimetype || mimetypes.lookup(file);
    let Supplier;

    if (!mime) {
        throw new E.UnknownFiletypeError(file, undefined, "Unable to probe mimetype from filename");
    }

    if (_thumbSuppliers.has(mime)) {
        Supplier = _thumbSuppliers.get(mime);
    } else if (_thumbSuppliers.has(mime.replace(/(.+\/)(.+)/, "$1*"))) {
        // regex to replace application/json -> application/*
        Supplier = _thumbSuppliers.get(mime.replace(/(.+\/)(.+)/, "$1*"));
    } else {
        throw new E.UnknownFiletypeError(file, mime, "FileType has no associated ThumbnailSupplier");
    }

    return new Supplier(options);
}

_registerThumbSupplier("video/*", require("./thumbs/video-thumb"));

module.exports.ThumbSize = ThumbSize



const lookupThumbnail = (file, options) => {
    return new Promise((resolve, reject) => {
        options = Object.assign(_defaultOptions, options || {});

        fs.stat(file, (err, stats) => {
            if (err) return reject(err);

            const fileModifiedTime = stats.mtime;
            const supplier = _fetchThumbnailSupplier(file, options);
            const thumbnailPath = supplier.getThumbnailLocation(file);

            fs.stat(thumbnailPath, (err, stats) => {
                if (err) return reject(err);

                if (stats.mtime.getTime() < fileModifiedTime.getTime()) {
                    reject(new E.ThumbnailExpiredError(thumbnailPath, "Thumbnail Expired"));
                } else {
                    resolve(thumbnailPath);
                }
            });
        });
    });
}


const generateThumbnail = (file, options) => {
    return new Promise((resolve, reject) => {
        options = Object.assign(_defaultOptions, options || {});

        const supplier = _fetchThumbnailSupplier(file, options);

        if (options.forceCreate) {
            supplier.createThumbnail(file)
                .then(resolve)
                .catch(reject);
        } else {
            lookupThumbnail(file, options)
                .then(resolve)
                .catch(() => {
                    supplier.createThumbnail(file)
                        .then(resolve)
                        .catch(reject);
                });
        }
    });
}

module.exports.generateThumbnail = generateThumbnail
module.exports.lookupThumbnail = lookupThumbnail