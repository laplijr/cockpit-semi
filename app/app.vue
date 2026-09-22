<template>
  <!-- Une navigation qui attend sa page ne montre rien : le fil dit qu'elle
       est partie. Sans lui, un clic sans effet visible passe pour un clic raté. -->
  <NuxtLoadingIndicator color="var(--color-accent)" :height="2" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
