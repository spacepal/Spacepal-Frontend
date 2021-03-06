<template>
  <div>
    <div class="background full" v-if="isVisible"></div>
    <transition name="scale" mode="out-in">
      <div v-if="isVisible" class="full">
        <div id="window">
          <div id="title">
            <div class="loop_bg">
              {{title || 'No title'}}
            </div>
          </div>
          <div id="body">
            <p>
              <slot></slot>
            </p>
          </div>
          <div id="control">
            <template v-if="isConfirm">
              <div class="button" @click="reject">
                 {{ $t('Cancel') }}
              </div>
              <div class="button" @click="confirm" :class="confirmClass">
                {{ $t('Confirm') }}
              </div>
            </template>
            <template v-if="isAlert">
              <div class="button" @click="confirm">
                {{ $t('Ok') }}
              </div>
            </template>
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
const TYPE_CONFIRM = 'confirm'
const TYPE_ALERT = 'alert'

export default {
  name: 'Window',
  props: {
    title: String,
    type: {
      type: String,
      default: TYPE_ALERT
    },
    enabled: Boolean
  },
  data () {
    return {
      isVisible: false,
      isConfirm: this.type === TYPE_CONFIRM,
      isAlert: this.type === TYPE_ALERT,
      hotKeys: [
        {
          code: 'Enter',
          isKey: true,
          method: this.confirm,
          modalEnabled: true,
          en: () => this.isVisible
        },
        {
          code: 'Escape',
          isKey: true,
          method: this.close,
          modalEnabled: true,
          en: () => this.isVisible
        }
      ]
    }
  },
  computed: {
    confirmClass () {
      return this.enabled ? '' : 'disabled'
    }
  },
  methods: {
    show () {
      this.isVisible = true
      this.$disableHotKeys()
    },
    close () {
      this.isVisible = false
      this.$enableHotKeys()
      this.$emit('close')
    },
    reject () {
      this.$emit('reject')
      this.close()
    },
    confirm () {
      if (this.type === TYPE_ALERT) {
        this.close()
      } else if (this.enabled) {
        this.$emit('confirm')
        this.close()
      }
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../css/components/_window.scss';
</style>
