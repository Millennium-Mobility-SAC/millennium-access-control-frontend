import { ref } from 'vue';
import { useNotification } from './use-notification.js';

/**
 * Composable genérico para visualización y descarga de imágenes/documentos
 * Puede ser utilizado en cualquier módulo de la aplicación
 */
export function useImageViewer() {
  const { showSuccess, showError, showInfo } = useNotification();

  // State
  const showModal = ref(false);
  const currentImage = ref(null);
  const zoom = ref(1);

  /**
   * Abrir modal con la imagen seleccionada
   * @param {Object} image - Objeto con url, description, alt
   */
  const openImage = (image) => {
    currentImage.value = {
      url: image.url,
      name: image.description || image.alt || 'Imagen',
      alt: image.alt || image.description || ''
    };
    zoom.value = 1;
    showModal.value = true;
  };

  /**
   * Cerrar modal de visualización
   */
  const closeModal = () => {
    showModal.value = false;
    currentImage.value = null;
    zoom.value = 1;
  };

  /**
   * Aumentar zoom
   */
  const zoomIn = () => {
    if (zoom.value < 3) {
      zoom.value += 0.25;
    }
  };

  /**
   * Disminuir zoom
   */
  const zoomOut = () => {
    if (zoom.value > 0.5) {
      zoom.value -= 0.25;
    }
  };

  /**
   * Resetear zoom
   */
  const resetZoom = () => {
    zoom.value = 1;
  };

  /**
   * Descargar imagen actual
   */
  const downloadCurrentImage = async () => {
    if (!currentImage.value) return;
    
    await downloadImage({
      url: currentImage.value.url,
      description: currentImage.value.name,
      alt: currentImage.value.alt
    });
  };

  /**
   * Descargar imagen
   * @param {Object} image - Objeto con url, description, alt
   */
  const downloadImage = async (image) => {
    try {
      if (!image || !image.url) {
        console.warn('No se puede descargar la imagen: URL no válida');
        showError('URL no válida', 'Error');
        return;
      }

      console.log('Iniciando descarga de:', image.url);
      showInfo('Preparando descarga...', 'Descargando');

      const filename = generateFileName(image);
      await performDownload(image.url, filename);

      console.log('Imagen descargada correctamente');
      showSuccess('Imagen descargada correctamente', 'Éxito');

    } catch (error) {
      console.error('Error al descargar imagen:', error);
      showError('No se pudo descargar la imagen. Intente nuevamente.', 'Error de descarga');
    }
  };

  /**
   * Ejecutar descarga del archivo
   */
  const performDownload = async (url, filename) => {
    // Para imágenes, intentar método canvas primero
    if (isImageFile(url)) {
      console.log('Detectada imagen, usando método canvas para:', url);
      try {
        await downloadImageWithCanvas(url, filename);
        return;
      } catch (error) {
        console.warn('Método canvas falló, intentando fetch:', error);
      }
    }

    try {
      console.log('Intentando descarga con fetch para:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        },
        mode: 'cors'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('Archivo descargado como blob, tamaño:', blob.size);
      downloadBlob(blob, filename);

    } catch (error) {
      console.warn('Descarga con fetch falló, usando método alternativo:', error);
      downloadWithLink(url, filename);
    }
  };

  /**
   * Descargar imagen usando canvas
   */
  const downloadImageWithCanvas = (url, filename) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              console.log('Imagen convertida a blob con canvas, tamaño:', blob.size);
              downloadBlob(blob, filename);
              resolve();
            } else {
              reject(new Error('No se pudo convertir imagen a blob'));
            }
          }, 'image/png', 1.0);

        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Error al cargar imagen para canvas'));
      };

      img.src = url;
    });
  };

  /**
   * Descargar blob
   */
  const downloadBlob = (blob, filename) => {
    try {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      console.error('Error en downloadBlob:', error);
      throw error;
    }
  };

  /**
   * Descargar con enlace directo
   */
  const downloadWithLink = (url, filename) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'imagen';
      link.target = '_blank';
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 100);

    } catch (error) {
      console.error('Error en downloadWithLink:', error);
      window.open(url, '_blank');
    }
  };

  /**
   * Generar nombre de archivo
   */
  const generateFileName = (image) => {
    const timestamp = new Date().getTime();
    let baseName = 'imagen';

    if (image.description) {
      baseName = image.description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } else if (image.alt) {
      baseName = image.alt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const extension = getFileExtension(image.url);
    return `${baseName}-${timestamp}${extension}`;
  };

  /**
   * Obtener extensión del archivo
   */
  const getFileExtension = (url) => {
    if (!url) return '.png';
    
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return '.jpg';
    if (urlLower.includes('.png')) return '.png';
    if (urlLower.includes('.gif')) return '.gif';
    if (urlLower.includes('.webp')) return '.webp';
    if (urlLower.includes('.pdf')) return '.pdf';
    
    return '.png'; // Default
  };

  /**
   * Verificar si es archivo de imagen
   */
  const isImageFile = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.includes('.jpg') || 
           urlLower.includes('.jpeg') || 
           urlLower.includes('.png') || 
           urlLower.includes('.gif') || 
           urlLower.includes('.webp');
  };

  /**
   * Manejar error de carga de imagen
   */
  const handleImageError = (event) => {
    console.error('Error al cargar imagen:', event);
    showError('No se pudo cargar la imagen', 'Error');
  };

  return {
    // State
    showModal,
    currentImage,
    zoom,
    
    // Methods
    openImage,
    closeModal,
    zoomIn,
    zoomOut,
    resetZoom,
    downloadImage,
    downloadCurrentImage,
    handleImageError
  };
}
