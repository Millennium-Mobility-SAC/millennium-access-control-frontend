<script setup>

// logo-millennium-mobility como constante
import logoMillenniumMobility from '@/assets/img/logo-millennium-mobility.png';

</script>

<template>
    <div class="bg-gradient flex flex-column align-items-center justify-content-center gap-5 px-5 py-6 md:px-6 relative w-full md:w-6 md:h-screen">
        <div class="flex flex-column align-items-center text-center gap-3 px-2 w-full">
            <h1 class="text-3xl md:text-5xl font-bold m-0 text-white line-height-2">
                Bienvenido a Millennium Mobility
            </h1>
            <p class="text-base md:text-xl m-0 text-white opacity-90 line-height-3">
                Control de Acceso y Gestión de Personal
            </p>
        </div>
        <div class="flex align-items-center justify-content-center">
            <div class="app-logo flex align-items-center justify-content-center">
                <img :src="logoMillenniumMobility" alt="Millennium Mobility" class="app-logo-img" />
            </div>
        </div>
        <div class="hidden md:block absolute bottom-0 left-0 right-0 pb-3 text-center">
            <p class="text-sm text-white-alpha-70 m-0">
                &copy; {{ new Date().getFullYear() }} Metasoft Solutions SAC. Todos los derechos reservados.
            </p>
        </div>
    </div>
</template>

<style scoped>
.bg-gradient {
    position: relative;
    background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-primary) 100%);
}
.bg-gradient::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 20% 30%, rgba(26, 107, 194, 0.08) 0%, transparent 50%);
    pointer-events: none;
}
.app-logo {
    width: clamp(10rem, 20vw, 14rem);
    height: clamp(10rem, 20vw, 14rem);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.45);
    backdrop-filter: blur(8px);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}
.app-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
