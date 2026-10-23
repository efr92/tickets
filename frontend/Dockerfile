FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
# VITE_DEV_TOOLS=1 показывает на шаге проверки кнопки «имитировать: места разобрали»
ARG VITE_DEV_TOOLS=0
ENV VITE_DEV_TOOLS=$VITE_DEV_TOOLS
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
