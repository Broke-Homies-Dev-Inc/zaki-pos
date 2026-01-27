// backend/src/routes/upload.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
    }
  },
});

// Image upload endpoint for menu items
router.post('/menu-item-image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const { category, sub_category, item_name } = req.body;

    if (!category || !item_name) {
      return res.status(400).json({ message: 'category and item_name are required' });
    }

    // Sanitize filename (remove special characters, replace spaces with hyphens)
    const sanitizedItemName = item_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sanitizedCategory = category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sanitizedSubCategory = sub_category
      ? sub_category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      : null;

    // Build the directory path
    const baseDir = '/srv/zaki/image-server/images/menu';
    let dirPath: string;
    let filename: string;

    if (sanitizedSubCategory) {
      dirPath = path.join(baseDir, sanitizedCategory, sanitizedSubCategory);
      filename = `${sanitizedItemName}.webp`;
    } else {
      dirPath = path.join(baseDir, sanitizedCategory);
      filename = `${sanitizedItemName}.webp`;
    }

    // Create directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    const filePath = path.join(dirPath, filename);

    // Convert image to WebP and save
    await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toFile(filePath);

    // Build the URL
    const imageServerBaseUrl = process.env.IMAGE_SERVER_URL || 'https://zakitrading.om/images/menu';
    let imageUrl: string;

    if (sanitizedSubCategory) {
      imageUrl = `${imageServerBaseUrl}/${sanitizedCategory}/${sanitizedSubCategory}/${filename}`;
    } else {
      imageUrl = `${imageServerBaseUrl}/${sanitizedCategory}/${filename}`;
    }

    res.json({ image_url: imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

// Delete menu item image
router.delete('/menu-item-image', async (req: Request, res: Response) => {
  try {
    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({ message: 'image_url is required' });
    }

    // Extract the path from the URL
    const imageServerBaseUrl = process.env.IMAGE_SERVER_URL || 'https://zakitrading.om/images/menu';
    const relativePath = image_url.replace(imageServerBaseUrl, '');
    const filePath = path.join('/srv/zaki/image-server/images/menu', relativePath);

    // Delete the file if it exists
    try {
      await fs.unlink(filePath);
      res.json({ message: 'Image deleted successfully' });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, that's okay
        res.json({ message: 'Image not found (already deleted)' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

export default router;
