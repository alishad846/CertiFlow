// @ts-nocheck
export default class Manager {
    refs = {};
  
    add(collection, ref) {
      if (!this.refs[collection]) {
        this.refs[collection] = [];
      }
  
      this.refs[collection].push(ref);
    }
  
    remove(collection, ref) {
      const index = this.getIndex(collection, ref);
  
      if (index !== -1) {
        this.refs[collection].splice(index, 1);
      }
    }
  
    isActive() {
      return this.active;
    }
  
    getActive() {
      return this.refs[this.active.collection]?.find(
        ({node}) => node.sortableInfo.index === this.active.index,
      );
    }

    // React 19 StrictMode + the async-ref (requestAnimationFrame) registration in SortableElement
    // can race so that this.refs[collection] ends up empty even though every sortable node still
    // carries a valid `sortableInfo` (pointing back at this manager). Without refs, getActive()
    // returns nothing and a drag can never start. Rebuild the ref list from the live DOM nodes so
    // drag-to-reorder works regardless of the registration timing.
    rehydrateFromContainer(container, collection = 0) {
      if (!container) return;
      const refs = [];
      container.querySelectorAll('*').forEach((node) => {
        const info = node.sortableInfo;
        if (info && info.manager === this && info.collection === collection) {
          refs.push({node});
        }
      });
      if (refs.length) {
        this.refs[collection] = refs;
      }
    }
  
    getIndex(collection, ref) {
      return this.refs[collection]?.indexOf(ref);
    }
  
    getOrderedRefs(collection = this.active.collection) {
      return this.refs[collection].sort(sortByIndex);
    }
  }
  
  function sortByIndex(
    {
      node: {
        sortableInfo: {index: index1},
      },
    },
    {
      node: {
        sortableInfo: {index: index2},
      },
    },
  ) {
    return index1 - index2;
  }
  