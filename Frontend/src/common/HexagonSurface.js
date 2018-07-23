import Cell from './Cell.js'
import { mapGetters } from 'vuex'
import { calcDistance } from './DistanceHelper.js'

const TRANSLATE_SCALE_FACTOR = 1.5

export default {
  data () {
    return {
      offsetDX: 0,
      degree: 2.0 / 3.0 * Math.PI,
      a: 0,
      dx: 0,
      dy: 0,
      context: undefined,
      scale: 1.0,
      cells: {
        all: [],
        active: []
      },
      centeredIndex: -1,
      hoveredIndex: undefined,
      selectedIndex: -1,
      pending: {
        scale: 1.0,
        dx: 0,
        dy: 0
      },
      paused: true,
      mapSize: {
        width: 0,
        height: 0
      },
      frames: 0,
      fps: 0
    }
  },
  computed: {
    ...mapGetters({
      planetByCellID: 'planet',
      theBestPlanet: 'theBestPlanet'
    }),
    renderedCount () {
      return this.cells.active.length
    }
  },
  mounted () {
    this._fpsTimeout = undefined
    let fpsFunc = () => {
      this.fps = this.frames
      this.frames = 0
      this._fpsTimeout = setTimeout(fpsFunc, 1000)
    }
    fpsFunc()

    this._centeredAnimTimerFunc = () => {
      let cell = this.cells.all[this.centeredIndex]
      if (cell) {
        cell.isCentered = !cell.isCentered
        cell.render(this.context)
      }
      setTimeout(this._centeredAnimTimerFunc, 350)
    }
    this._centeredAnimTimerFunc()
  },
  beforeDestroy () {
    clearTimeout(this._fpsTimeout)
  },
  methods: {
    _genSurface (a) {
      this.cells.active = []
      this.cells.all = []
      for (let y = 0, count = 1; y < this.mapSize.height; ++y) {
        for (let x = 0; x < this.mapSize.width; ++x) {
          this.cells.all.push(new Cell({ x, y }, a, count++, this.degree))
        }
      }
    },
    _relPosCalculator () {
      let { width, height } = this.context.canvas
      let rect = this.context.canvas.getBoundingClientRect()
      let globScale = { // DOM
        x: width / rect.width,
        y: height / rect.height
      }
      return ({x, y}) => {
        x *= globScale.x
        y *= globScale.y

        x += -width * 0.5 * (1 - this.scale)
        x /= this.scale
        x -= this.dx

        y += -height * 0.5 * (1 - this.scale)
        y /= this.scale
        y -= this.dy

        return { x, y }
      }
    },
    selectCell (cellID) {
      this.unselectLastCell()
      this.selectedIndex = cellID
      this._switchCell(cellID, true)
    },
    unselectLastCell () {
      if (this.selectedIndex >= 0) {
        this._switchCell(this.selectedIndex, false)
        this.selectedIndex = -1
      }
    },
    _switchCell (cellID, selected) {
      let cell = this.cells.all[cellID]
      cell.isSelected = selected
      cell.render(this.context)
    },
    resolvePlanet ({ mx, my }) {
      let cell = this._resolveCell(this.context, { mx, my })
      if (cell === undefined) {
        return undefined
      }
      return this.planetByCellID(cell.id)
    },
    _resolveCell (ctx, {mx, my}) {
      let calc = this._relPosCalculator(ctx)
      let pos = calc({x: mx, y: my})
      return this.cells.active.find(cell => cell.isPointOver(pos))
    },
    onSurfaceMouseMove ({ mx, my }) {
      if (this._moveLock) {
        return
      }
      this._moveLock = true

      if (this.hoveredIndex !== undefined) {
        this.cells.all[this.hoveredIndex].isHovered = false
        this.cells.all[this.hoveredIndex].render(this.context)
      }

      let cell = this._resolveCell(this.context, {mx, my})
      if (cell) {
        cell.isHovered = true
        this.hoveredIndex = cell.id - 1
        if (this.selectedIndex !== -1) {
          let distance = calcDistance(this.selectedIndex + 1,
            cell.id, this.$store.getters['game/info'].mapWidth)
          cell.render(this.context, distance)
        } else {
          cell.render(this.context)
        }
      }
      this._moveLock = false
    },
    pause () {
      this.paused = true
    },
    play () {
      this.paused = false
    },
    init (ctx, a, mapSizeWidth, mapSizeHeight, offsetX = 0) {
      this.a = a
      this.offsetDX = offsetX
      this.mapSize.width = mapSizeWidth
      this.mapSize.height = mapSizeHeight
      this.context = ctx
      this._genSurface(a)
      if (!this._tick) {
        this._tick = () => {
          if (!this.paused) {
            this.redraw(this.context)
          }
          requestAnimationFrame(this._tick)
        }
        requestAnimationFrame(this._tick)
      }
    },
    tick () {
      requestAnimationFrame(() => this.redraw(this.context))
    },
    translateSurface ({dx, dy}, considerScale = false) {
      this.pending.dx += dx * (considerScale
        ? TRANSLATE_SCALE_FACTOR / this.scale : 1.0)
      this.pending.dy += dy * (considerScale
        ? TRANSLATE_SCALE_FACTOR / this.scale : 1.0)
      this.highlightCenterize(null)
    },
    scaleSurface (scale) {
      this.pending.scale *= scale
      this.highlightCenterize(null)
    },
    goHome () {
      let p = this.theBestPlanet
      if (p) {
        return this.goToCell(p.cellID, false)
      }
      let firstCell = this.cells.all[0]
      if (!firstCell) {
        return this.clearOffset()
      }
      let { width, height } = this.context.canvas
      this.dx = width / 2.0 -
        firstCell.relativeWidth * this.mapSize.width / 2.0 -
        this.offsetDX
      this.dy = height / 2.0 - firstCell.height * this.mapSize.height / 2.0
      this.scale = 1.0
      this.tick()
    },
    highlightCenterize (cellIndex) {
      let _highlightCenterize = (cI, centered) => {
        let cell = this.cells.all[cI]
        if (cell) {
          cell.isCentered = centered
          cell.render(this.context)
        }
      }
      _highlightCenterize(this.centeredIndex, false)
      _highlightCenterize(cellIndex, true)
      this.centeredIndex = cellIndex
    },
    goToCell (cellID, highlight = true) {
      let cell = this.cells.all[cellID - 1]
      if (!cell) {
        return
      }
      this.scale = 2.0
      let { width, height } = this.context.canvas
      this.dx = -cell.startPoint.x +
      (width - cell.width) * 0.5 -
      this.offsetDX
      this.dy = -cell.startPoint.y + (height - cell.height) * 0.5
      this.tick()
      if (highlight) {
        this.highlightCenterize(cellID - 1)
      }
    },
    _scaleOverCenter (ctx, scale) {
      let { width, height } = ctx.canvas
      let cx = width * 0.5
      let cy = height * 0.5
      ctx.translate(cx - this.dx, cy - this.dy)
      ctx.scale(scale, scale)
      ctx.translate(-cx + this.dx, -cy + this.dy)
    },
    clearOffset () {
      this.dx = 0
      this.dy = 0
      this.scale = 1.0
    },
    redraw (ctx) {
      let { scale, dx, dy } = this.pending
      this.pending = { scale: 1.0, dx: 0.0, dy: 0.0 }

      this.dx += dx
      this.dy += dy
      this.scale *= scale

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      let { width, height } = ctx.canvas
      ctx.clearRect(0, 0, width, height)
      ctx.translate(this.dx, this.dy)
      this._scaleOverCenter(ctx, this.scale)

      let realPosCalc = this._relPosCalculator()
      let rect = this.context.canvas.getBoundingClientRect()
      let visibilityOffset = this.a * this.scale
      let startPoint = realPosCalc({
        x: -visibilityOffset * 1.5,
        y: -visibilityOffset * 1.75
      })
      let endPoint = realPosCalc({
        x: rect.width + visibilityOffset,
        y: rect.height + visibilityOffset
      })
      this.cells.active = this.cells.all.filter(cell => {
        if (cell.firstPoint.x > startPoint.x &&
          cell.firstPoint.x < endPoint.x &&
          cell.firstPoint.y > startPoint.y &&
          cell.firstPoint.y < endPoint.y) {
          cell.render(ctx)
          return true
        }
      })
      this.frames++
    }
  }
}
