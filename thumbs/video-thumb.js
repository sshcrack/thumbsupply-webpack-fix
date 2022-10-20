const ffmpeg = require("fluent-ffmpeg");

const ThumbnailSupplier = require("../thumb.js");

function ratioStringToParts(str) {
    return str.split(":").map(n => parseInt(n, 10));
}

const probeVideo = video => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(video, (err, metadata) => {
            if (err)
                return reject(err)

            resolve(metadata)
        });
    })
}

class VideoThumbnailSupplier extends ThumbnailSupplier {

    constructor(options) {
        super(options);
        this.timestamp = options.timestamp || "10%";
    }

    createThumbnail(video) {
        return new Promise((resolve, reject) => {
            this.getVideoDimension(video)
                .then(this.getOptimalThumbnailResolution.bind(this))
                .then(res => {
                    ffmpeg(video)
                        .on("end", () => resolve(super.getThumbnailLocation(video)))
                        .on("error", reject)
                        .screenshots({
                            size: `${res.width}x${res.height}`,
                            timestamps: [this.timestamp],
                            filename: ThumbnailSupplier.getThumbnailFileName(video),
                            folder: this.cacheDir
                        });
                })
                .catch(() => {
                    ffmpeg(video)
                        .on("end", () => resolve(super.getThumbnailLocation(video)))
                        .on("error", reject)
                        .screenshots({
                            size: `${this.size.width}x${this.size.height}`,
                            timestamps: [this.timestamp],
                            filename: ThumbnailSupplier.getThumbnailFileName(video),
                            folder: this.cacheDir
                        });
                });
        });
    }

    async getVideoDimension(video) {
        const metadata = await probeVideo(video)
        const stream = metadata.streams.find(
            stream => stream.codec_type === "video"
        );

        if (!stream)
            throw new TypeError("Stream is null")

        const darString = stream.display_aspect_ratio;

        // ffprobe returns aspect ratios of "0:1" or `undefined` if they're not specified.
        // https://trac.ffmpeg.org/ticket/3798
        if (darString && darString !== "0:1" && darString !== "N/A") {
            // The DAR is specified so use it directly
            const [widthRatioPart, heightRatioPart] = ratioStringToParts(darString);
            const inverseDar = heightRatioPart / widthRatioPart;
            return {
                width: stream.width,
                height: stream.width * inverseDar
            };
        }
        // DAR not specified so assume square pixels (use sample resolution as-is).
        return {
            width: stream.width,
            height: stream.height
        };
    }

    getOptimalThumbnailResolution(videoDimension) {
        if (videoDimension.width > videoDimension.height) {
            return {
                width: this.size.width,
                height: Math.round(this.size.width * videoDimension.height / videoDimension.width)
            }
        } else {
            return {
                width: Math.round(this.size.height * videoDimension.width / videoDimension.height),
                height: this.size.height
            }
        }
    }
}

module.exports = VideoThumbnailSupplier;