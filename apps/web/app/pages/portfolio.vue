<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

interface Edition {
  id: string
  slug: string
  title: string
  purpose: string
  portfolio_kind: 'main' | 'client' | null
  portfolio_client: string | null
  publication_enabled: boolean
  itemCount: number
  previewAssets: Array<{ id: string; previewUrl: string; mime_type?: string | null }>
}

const { data, status, error, refresh } = await useFetch<{ data: { collections: Edition[] } }>('/api/shares')
const portfolios = computed(() => data.value?.data.collections.filter(item => item.purpose === 'portfolio') ?? [])

onActivated(() => refresh())
</script>

<template>
  <div class="portfolio-index">
    <header>
      <WorkspaceSwitcher class="identity" />
      <nav>
        <NuxtLink to="/library">Library</NuxtLink>
        <NuxtLink to="/portfolio" aria-current="page">Portfolio</NuxtLink>
        <NuxtLink to="/account">Account</NuxtLink>
      </nav>
    </header>
    <main>
      <section class="intro">
        <p>Portfolio</p>
        <h1>Create and publish<br>your portfolio.</h1>
        <ShareCollection portfolio-only />
      </section>
      <p v-if="status === 'pending'" class="state">Loading portfolios…</p>
      <p v-else-if="error" class="state">Unable to load portfolios.</p>
      <section v-else-if="portfolios.length" class="editions" aria-label="Portfolios">
        <article v-for="portfolio in portfolios" :key="portfolio.id">
          <NuxtLink class="cover" :to="`/boards/${portfolio.id}`">
            <AssetMedia v-if="portfolio.previewAssets[0]" :src="portfolio.previewAssets[0].previewUrl" :mime-type="portfolio.previewAssets[0].mime_type" alt="" />
            <span v-else>No work yet</span>
          </NuxtLink>
          <h2>
            <NuxtLink :to="`/boards/${portfolio.id}`">{{ portfolio.title }}</NuxtLink>
          </h2>
          <p>{{ portfolio.portfolio_kind === 'client' ? (portfolio.portfolio_client || 'Client version') : 'Main portfolio'
            }} · {{ portfolio.publication_enabled ? 'published' : 'draft' }}</p>
          <a v-if="portfolio.publication_enabled" :href="`/s/${portfolio.slug}`" target="_blank" rel="noopener">View published portfolio</a>
        </article>
      </section>
      <div v-else class="state">
        <strong>No portfolio yet</strong>
        <span>Create one, add work, and publish when it is ready.</span>
      </div>
    </main>
  </div>
</template>

<style scoped>
.portfolio-index {
  min-height: 100vh;
  padding: var(--space);
}

header {
  position: sticky;
  z-index: 3;
  top: 0;
  display: flex;
  min-height: var(--control-height);
  align-items: center;
  justify-content: space-between;
  background: rgb(255 255 255 / 95%);
}

header nav {
  display: flex;
  gap: var(--space);
}

header [aria-current="page"] {
  color: var(--color-muted);
}

main {
  padding-top: clamp(5rem, 10vw, 10rem);
}

.intro {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
  align-items: end;
  margin-bottom: clamp(5rem, 10vw, 10rem);
}

.intro p {
  margin: 0;
  color: var(--color-muted);
}

.intro h1 {
  grid-column: 2 / 5;
}

.intro :deep(.share-trigger) {
  grid-column: 2;
  justify-self: start;
}

.case-library {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
  margin-bottom: clamp(5rem, 10vw, 10rem);
}

.case-library>div:first-child {
  grid-column: 1 / 3;
}

.case-library h2,
.case-library p {
  margin: 0;
}

.case-actions {
  grid-column: 3 / 5;
  align-self: end;
  justify-self: start;
  width: min(100%, 28rem);
}

.case-actions form {
  display: grid;
  gap: calc(var(--space) / 2);
}

.case-actions label {
  display: grid;
  gap: calc(var(--space) / 3);
  color: var(--color-muted);
}

.case-actions input {
  width: 100%;
  min-height: var(--control-height);
  color: var(--color-fg);
}

.case-form-actions {
  display: flex;
  align-items: center;
  gap: var(--space);
}

.case-form-actions .button-plain {
  min-height: var(--control-height);
}

.case-actions small {
  min-height: 1em;
  color: var(--color-danger);
}

.case-list {
  grid-column: 1 / 5;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space);
}

.case-list a {
  display: flex;
  justify-content: space-between;
  gap: var(--space);
  padding: var(--space);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.case-list small,
.case-library>.muted {
  color: var(--color-muted);
}

.editions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: calc(var(--space) * 2) var(--space);
}

article {
  display: grid;
  gap: calc(var(--space) / 2);
}

.cover {
  aspect-ratio: 4 / 3;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--color-surface);
}

.cover :is(img,video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover span,
article p,
article>a {
  color: var(--color-muted);
}

article h2,
article p {
  margin: 0;
}

.state {
  min-height: 40vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--cluster-gap);
  text-align: center;
}

@media (max-width: 800px) {

  .intro,
  .case-library {
    grid-template-columns: 1fr;
  }

  .intro h1,
  .intro :deep(.share-trigger),
  .case-library>div:first-child,
  .case-actions,
  .case-list {
    grid-column: 1;
  }

  .case-actions {
    justify-self: start;
  }

  .case-list,
  .editions {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 520px) {
  .editions {
    grid-template-columns: 1fr;
  }
}
</style>
