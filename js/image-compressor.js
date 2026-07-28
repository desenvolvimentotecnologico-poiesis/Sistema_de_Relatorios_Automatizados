/**
 * COMPRESSOR DE IMAGENS EM NAVEGADOR (OTIMIZADO PARA MÓBILE)
 * Redimensiona fotos da câmera para uma resolução máxima otimizada (1600px)
 * e aplica compressão JPEG a 80%, reduzindo o tamanho de ~6MB para ~250KB por foto.
 */

const ImageCompressor = {
  /**
   * Converte e compacta um File de imagem para um objeto Base64
   * @param {File} file Arquivo de imagem obtido via input ou drag-drop
   * @param {number} maxWidth Resolução máxima de largura/altura (default 1600)
   * @param {number} quality Qualidade do JPEG entre 0 e 1 (default 0.8)
   * @returns {Promise<Object>} Promessa contendo { name, mimeType, base64Data }
   */
  compressFile: function(file, maxWidth = 1000, quality = 0.7) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("O arquivo selecionado não é uma imagem válida."));
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          const base64Data = dataUrl.split(",")[1];

          resolve({
            name: file.name,
            mimeType: "image/jpeg",
            base64Data: base64Data
          });
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }
};
