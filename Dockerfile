# Etapa 1: Construcción (Node.js)
FROM node:20-alpine as builder

# Directorio de trabajo
WORKDIR /app

# Copiamos solo el package.json y package-lock.json (si existe) primero para aprovechar el caché de Docker
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Compilamos la aplicación para producción con Vite
RUN npm run build

# Etapa 2: Servidor Web Ligero (Nginx)
FROM nginx:alpine

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los archivos compilados estáticos desde la etapa de construcción 'builder'
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponemos el puerto 80 del contenedor
EXPOSE 80

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
